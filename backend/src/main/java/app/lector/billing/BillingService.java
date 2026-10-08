package app.lector.billing;

import app.lector.classroom.ClassMembersChanged;
import app.lector.classroom.ClassroomMemberRepository;
import app.lector.common.ApiException;
import app.lector.user.Tier;
import app.lector.user.User;
import app.lector.user.UserRepository;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Real billing (stripe-billing.feature): Checkout to subscribe, the portal to manage, and Stripe's webhook as the
 * only thing that changes a paid plan. Each subscription event re-reads the subscription from Stripe, so repeated or
 * out-of-order events always land on Stripe's current state.
 */
@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    /** The prices people can buy (Stripe lookup keys) and the plan each gives. */
    static final Map<String, Tier> PLANS =
            Map.of("pro_monthly", Tier.PRO, "pro_yearly", Tier.PRO, "classroom_monthly", Tier.CLASSROOM);

    /** Subscription states that keep the plan: paid, or still being retried after a failed payment. */
    private static final Set<String> LIVE = Set.of("active", "trialing", "past_due");

    /** What Settings › Subscription shows. */
    public record Status(boolean enabled, boolean testMode, String plan, String interval, String status,
                         Instant periodEnd, boolean cancelAtPeriodEnd, boolean paymentProblem) {}

    private final StripeGateway stripe;
    private final StripeProperties props;
    private final BillingAccountRepository accounts;
    private final StripeEventRepository events;
    private final UserRepository users;
    private final ClassroomMemberRepository members;
    private final Clock clock;

    public BillingService(StripeGateway stripe, StripeProperties props, BillingAccountRepository accounts,
                          StripeEventRepository events, UserRepository users, ClassroomMemberRepository members,
                          Clock clock) {
        this.stripe = stripe;
        this.props = props;
        this.accounts = accounts;
        this.events = events;
        this.users = users;
        this.members = members;
        this.clock = clock;
    }

    public boolean enabled() {
        return stripe.enabled();
    }

    @Transactional(readOnly = true)
    public Status status(User user) {
        Optional<BillingAccount> account = enabled() ? accounts.findById(user.getId()) : Optional.empty();
        return account.filter(a -> a.getPlan() != null)
                .map(a -> new Status(true, props.testMode(), a.getPlan(), a.getBillingInterval(), a.getStatus(),
                        a.getPeriodEnd(), a.isCancelAtPeriodEnd(), "past_due".equals(a.getStatus())))
                .orElse(new Status(enabled(), enabled() && props.testMode(), null, null, null, null, false, false));
    }

    /** A Checkout page for {@code plan}; the plan itself changes only when Stripe's webhook says it's paid. */
    @Transactional
    public String checkout(User user, String plan) {
        if (!enabled()) {
            throw ApiException.notFound("Billing");
        }
        Tier tier = PLANS.get(plan);
        if (tier == null) {
            throw ApiException.badRequest("Unknown plan: " + plan);
        }
        BillingAccount account = accountOf(user);
        long quantity = tier == Tier.CLASSROOM ? seats(user.getId()) : 1;
        return stripe.checkout(user.getId(), account.getStripeCustomerId(), new StripeGateway.Line(plan, quantity));
    }

    @Transactional(readOnly = true)
    public String portal(User user) {
        if (!enabled()) {
            throw ApiException.notFound("Billing");
        }
        BillingAccount account = accounts.findById(user.getId())
                .orElseThrow(() -> ApiException.badRequest("There is no subscription to manage yet"));
        return stripe.portal(account.getStripeCustomerId());
    }

    /** One customer per account, made on its first checkout. */
    private BillingAccount accountOf(User user) {
        return accounts.findById(user.getId()).orElseGet(() -> accounts.save(new BillingAccount(user.getId(),
                stripe.createCustomer(user.getId(), user.getEmail(), user.getDisplayName()))));
    }

    /** Applies a verified webhook event about a subscription, once per event. */
    @Transactional
    public void subscriptionEvent(String eventId, String subscriptionId) {
        if (events.existsById(eventId)) {
            return;
        }
        apply(stripe.subscription(subscriptionId));
        events.save(new StripeEvent(eventId, clock.instant()));
    }

    private void apply(Subscription sub) {
        Optional<BillingAccount> found = accounts.findByStripeCustomerId(sub.getCustomer());
        if (found.isEmpty()) {
            log.warn("Stripe subscription {} belongs to no account here (customer {})", sub.getId(), sub.getCustomer());
            return;
        }
        BillingAccount account = found.get();
        SubscriptionItem item = sub.getItems().getData().getFirst();
        String plan = item.getPrice().getLookupKey();
        boolean live = LIVE.contains(sub.getStatus()) && PLANS.containsKey(plan);
        Instant periodEnd = item.getCurrentPeriodEnd() == null ? null : Instant.ofEpochSecond(item.getCurrentPeriodEnd());
        String interval = item.getPrice().getRecurring() == null ? null : item.getPrice().getRecurring().getInterval();
        account.update(sub.getId(), item.getId(), live ? plan : null, live ? interval : null, sub.getStatus(),
                live ? periodEnd : null, live && Boolean.TRUE.equals(sub.getCancelAtPeriodEnd()));
        users.findById(account.getUserId()).ifPresent(user -> user.setTier(live ? PLANS.get(plan) : Tier.FREE));
    }

    /** Students in all of a teacher's classes, at least one seat. */
    private long seats(Long teacherId) {
        return Math.max(1, members.countStudentsOfTeacher(teacherId));
    }

    /** A Classroom subscription bills for the students who have joined; Stripe prorates the change. */
    @TransactionalEventListener
    public void classMembersChanged(ClassMembersChanged change) {
        if (!enabled()) {
            return;
        }
        accounts.findById(change.teacherId())
                .filter(a -> "classroom_monthly".equals(a.getPlan()) && a.getItemId() != null)
                .ifPresent(a -> {
                    try {
                        stripe.setQuantity(a.getItemId(), seats(change.teacherId()));
                    } catch (ApiException e) {
                        // The class change stands; the next change or a portal visit brings the count back in line.
                        log.warn("Seat count for teacher {} not updated: {}", change.teacherId(), e.getMessage());
                    }
                });
    }

    /** Before an account is deleted: its subscription ends at once, so it is never charged again. */
    public void cancelForDeletion(User user) {
        if (!enabled()) {
            return;
        }
        accounts.findById(user.getId())
                .filter(a -> a.getStripeSubscriptionId() != null && LIVE.contains(a.getStatus()))
                .ifPresent(a -> {
                    try {
                        stripe.cancel(a.getStripeSubscriptionId());
                    } catch (ApiException e) {
                        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "payments_unavailable",
                                "Couldn't cancel your subscription, so the account wasn't deleted. Please try again.");
                    }
                });
    }
}
