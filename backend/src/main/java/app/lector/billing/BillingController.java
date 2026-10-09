package app.lector.billing;

import app.lector.common.ApiException;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.net.Webhook;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    public record CheckoutRequest(String plan) {}

    private final CurrentUser currentUser;
    private final BillingService billing;
    private final StripeProperties props;
    private final ObjectMapper json;

    public BillingController(CurrentUser currentUser, BillingService billing, StripeProperties props, ObjectMapper json) {
        this.currentUser = currentUser;
        this.billing = billing;
        this.props = props;
        this.json = json;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public BillingService.Status status(@AuthenticationPrincipal AuthUser principal) {
        return billing.status(currentUser.load(principal));
    }

    @PostMapping("/checkout")
    @Transactional
    public Map<String, String> checkout(@AuthenticationPrincipal AuthUser principal, @RequestBody CheckoutRequest req) {
        return Map.of("url", billing.checkout(currentUser.load(principal), req.plan()));
    }

    @PostMapping("/portal")
    @Transactional(readOnly = true)
    public Map<String, String> portal(@AuthenticationPrincipal AuthUser principal) {
        return Map.of("url", billing.portal(currentUser.load(principal)));
    }

    @PostMapping("/webhook")
    public void webhook(@RequestBody String payload,
                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        if (!billing.enabled()) {
            throw ApiException.notFound("Billing");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signature == null ? "" : signature, props.webhookSecret());
        } catch (SignatureVerificationException | RuntimeException e) {
            throw ApiException.badRequest("Invalid Stripe signature");
        }
        if (event.getType() == null || !event.getType().startsWith("customer.subscription.")) {
            return;
        }
        String subscriptionId;
        try {
            subscriptionId = json.readTree(payload).path("data").path("object").path("id").asString();
        } catch (JacksonException e) {
            throw ApiException.badRequest("Malformed Stripe event");
        }
        billing.subscriptionEvent(event.getId(), subscriptionId);
    }
}
