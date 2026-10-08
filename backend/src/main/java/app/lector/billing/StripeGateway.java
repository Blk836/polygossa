package app.lector.billing;

import app.lector.common.ApiException;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Price;
import com.stripe.model.Subscription;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.PriceListParams;
import com.stripe.param.SubscriptionItemUpdateParams;
import com.stripe.param.billingportal.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The only door to Stripe (stripe-billing.feature): every call the app makes, on the official client. Without a
 * secret key there is no client and billing is off. Stripe failing becomes a 503 the learner can retry.
 */
@Component
public class StripeGateway {

    private static final Logger log = LoggerFactory.getLogger(StripeGateway.class);

    /** One checkout's line: the price (by lookup key) and how many. */
    public record Line(String lookupKey, long quantity) {}

    private final StripeClient client;
    private final StripeProperties props;

    public StripeGateway(StripeProperties props) {
        this.props = props;
        if (!props.enabled()) {
            client = null;
            return;
        }
        StripeClient.StripeClientBuilder builder = StripeClient.builder().setApiKey(props.secretKey())
                .setMaxNetworkRetries(1);
        if (!props.apiBase().isBlank()) {
            builder.setApiBase(props.apiBase());
        }
        client = builder.build();
    }

    public boolean enabled() {
        return client != null;
    }

    @FunctionalInterface
    private interface Call<T> {
        T run() throws StripeException;
    }

    private <T> T call(String what, Call<T> call) {
        if (client == null) {
            throw ApiException.notFound("Billing");
        }
        try {
            return call.run();
        } catch (StripeException e) {
            log.warn("Stripe {} failed: {}", what, e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "payments_unavailable",
                    "Payments are unavailable right now. Please try again.");
        }
    }

    public String createCustomer(long userId, String email, String name) {
        return call("customer", () -> client.v1().customers().create(CustomerCreateParams.builder()
                .setEmail(email).setName(name).putMetadata("userId", Long.toString(userId)).build())).getId();
    }

    /** A Checkout page for a subscription to {@code line}, returning to Settings › Subscription. */
    public String checkout(long userId, String customer, Line line) {
        String price = call("price lookup", () -> client.v1().prices().list(
                PriceListParams.builder().addLookupKey(line.lookupKey()).setActive(true).build()))
                .getData().stream().findFirst().map(Price::getId)
                .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "payments_unavailable",
                        "Payments are unavailable right now. Please try again."));
        String back = props.siteUrl() + "/settings/subscription?checkout=";
        var params = com.stripe.param.checkout.SessionCreateParams.builder()
                .setMode(com.stripe.param.checkout.SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(customer)
                .setClientReferenceId(Long.toString(userId))
                .addLineItem(com.stripe.param.checkout.SessionCreateParams.LineItem.builder()
                        .setPrice(price).setQuantity(line.quantity()).build())
                .setAutomaticTax(com.stripe.param.checkout.SessionCreateParams.AutomaticTax.builder()
                        .setEnabled(true).build())
                .setCustomerUpdate(com.stripe.param.checkout.SessionCreateParams.CustomerUpdate.builder()
                        .setAddress(com.stripe.param.checkout.SessionCreateParams.CustomerUpdate.Address.AUTO).build())
                .setSuccessUrl(back + "success")
                .setCancelUrl(back + "cancelled")
                .build();
        return call("checkout", () -> client.v1().checkout().sessions().create(params)).getUrl();
    }

    public String portal(String customer) {
        return call("portal", () -> client.v1().billingPortal().sessions().create(SessionCreateParams.builder()
                .setCustomer(customer).setReturnUrl(props.siteUrl() + "/settings/subscription").build())).getUrl();
    }

    public Subscription subscription(String id) {
        return call("subscription", () -> client.v1().subscriptions().retrieve(id));
    }

    /** Bills {@code quantity} seats from now on; Stripe prorates the difference. */
    public void setQuantity(String itemId, long quantity) {
        call("seat count", () -> client.v1().subscriptionItems().update(itemId, SubscriptionItemUpdateParams.builder()
                .setQuantity(quantity)
                .setProrationBehavior(SubscriptionItemUpdateParams.ProrationBehavior.CREATE_PRORATIONS)
                .build()));
    }

    /** Cancels at once: no further charges. */
    public void cancel(String subscriptionId) {
        call("cancel", () -> client.v1().subscriptions().cancel(subscriptionId));
    }
}
