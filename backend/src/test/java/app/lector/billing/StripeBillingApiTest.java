package app.lector.billing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.TestApi;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: real billing with Stripe (docs/acceptance/stripe-billing.feature), against a fake Stripe
 * ({@link StripeStub}); its own setup, since every other test has no Stripe and keeps the plan switch.
 */
@SpringBootTest(properties = {
        "test.database=stripe",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.stripe.secret-key=sk_test_fake",
        "app.stripe.webhook-secret=" + StripeStub.WEBHOOK_SECRET,
        "app.stripe.site-url=https://site.test"
})
@AutoConfigureMockMvc
class StripeBillingApiTest {

    private static final StripeStub STRIPE;

    static {
        try {
            STRIPE = new StripeStub();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void stripe(DynamicPropertyRegistry registry) {
        registry.add("app.stripe.api-base", STRIPE::apiBase);
    }

    @AfterAll
    static void stop() {
        STRIPE.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String ana;

    @BeforeEach
    void setUp() throws Exception {
        STRIPE.reset();
        api = new TestApi(mvc, json);
        ana = api.signup();
    }

    private JsonNode checkout(String token, String plan, int status) throws Exception {
        return api.post(token, "/api/billing/checkout", "{\"plan\":\"" + plan + "\"}", status);
    }

    private String customerOf(String token) throws Exception {
        checkout(token, "pro_monthly", 200);
        return STRIPE.calls("POST", "/v1/checkout/sessions").getLast().form().get("customer");
    }

    private int webhook(String payload, String signature) throws Exception {
        var request = post("/api/billing/webhook").contentType(MediaType.APPLICATION_JSON).content(payload);
        if (signature != null) {
            request.header("Stripe-Signature", signature);
        }
        return mvc.perform(request).andReturn().getResponse().getStatus();
    }

    /** Stripe reporting the subscription {@code id} of {@code customer} as it now is. */
    private void stripeSays(String id, String customer, String status, String lookupKey, boolean cancelAtPeriodEnd)
            throws Exception {
        String interval = lookupKey.endsWith("yearly") ? "year" : "month";
        STRIPE.subscription(id, customer, status, lookupKey, interval, Instant.parse("2026-11-08T00:00:00Z").getEpochSecond(),
                cancelAtPeriodEnd, 1);
        String event = StripeStub.event("evt_" + System.nanoTime(), "customer.subscription.updated", id, customer);
        assertThat(webhook(event, StripeStub.signature(event, StripeStub.WEBHOOK_SECRET))).isEqualTo(200);
    }

    private String tier(String token) throws Exception {
        return api.get(token, "/api/me", 200).get("plan").get("tier").asString();
    }

    // --- Upgrading ---

    @Test
    void upgradingOpensStripeCheckoutForThatPriceWithTheLearnersEmailAndChangesNothingYet() throws Exception {
        JsonNode me = api.get(ana, "/api/me", 200);

        JsonNode session = checkout(ana, "pro_yearly", 200);

        assertThat(session.get("url").asString()).isEqualTo("https://checkout.stripe.test/cs_1");
        Map<String, String> customer = STRIPE.calls("POST", "/v1/customers").getFirst().form();
        assertThat(customer).containsEntry("email", me.get("email").asString())
                .containsEntry("metadata[userId]", me.get("id").asString());
        Map<String, String> form = STRIPE.calls("POST", "/v1/checkout/sessions").getFirst().form();
        assertThat(form).containsEntry("mode", "subscription")
                .containsEntry("line_items[0][price]", "price_pro_yearly")
                .containsEntry("line_items[0][quantity]", "1")
                .containsEntry("automatic_tax[enabled]", "true")
                .containsEntry("customer_update[address]", "auto")
                .containsEntry("client_reference_id", me.get("id").asString())
                .containsEntry("success_url", "https://site.test/settings/subscription?checkout=success")
                .containsEntry("cancel_url", "https://site.test/settings/subscription?checkout=cancelled");
        assertThat(tier(ana)).isEqualTo("FREE");
    }

    @Test
    void eachAccountHasOneStripeCustomerReusedAfterwards() throws Exception {
        checkout(ana, "pro_monthly", 200);
        checkout(ana, "pro_yearly", 200);

        assertThat(STRIPE.calls("POST", "/v1/customers")).hasSize(1);
        var sessions = STRIPE.calls("POST", "/v1/checkout/sessions");
        assertThat(sessions.get(0).form().get("customer")).isEqualTo(sessions.get(1).form().get("customer"));
    }

    @Test
    void anUnknownPlanIsRefused() throws Exception {
        checkout(ana, "gold", 400);
        assertThat(STRIPE.calls("POST", "/v1/checkout/sessions")).isEmpty();
    }

    @Test
    void stripeBeingDownFailsCheckoutClearly() throws Exception {
        STRIPE.fail(true);
        JsonNode error = checkout(ana, "pro_monthly", 503);
        assertThat(error.get("message").asString()).isEqualTo("Payments are unavailable right now. Please try again.");
    }

    // --- The webhook ---

    @Test
    void thePaidSubscriptionArrivingByWebhookPutsTheLearnerOnPro() throws Exception {
        String customer = customerOf(ana);

        stripeSays("sub_1", customer, "active", "pro_monthly", false);

        assertThat(tier(ana)).isEqualTo("PRO");
        JsonNode billing = api.get(ana, "/api/billing", 200);
        assertThat(billing.get("enabled").asBoolean()).isTrue();
        assertThat(billing.get("testMode").asBoolean()).isTrue();
        assertThat(billing.get("plan").asString()).isEqualTo("pro_monthly");
        assertThat(billing.get("interval").asString()).isEqualTo("month");
        assertThat(billing.get("periodEnd").asString()).isEqualTo("2026-11-08T00:00:00Z");
        assertThat(billing.get("cancelAtPeriodEnd").asBoolean()).isFalse();
        assertThat(billing.get("paymentProblem").asBoolean()).isFalse();
    }

    @Test
    void theSameEventTwiceChangesThePlanOnce() throws Exception {
        String customer = customerOf(ana);
        STRIPE.subscription("sub_1", customer, "active", "pro_monthly", "month", 1_800_000_000L, false, 1);
        String event = StripeStub.event("evt_twice", "customer.subscription.created", "sub_1", customer);

        assertThat(webhook(event, StripeStub.signature(event, StripeStub.WEBHOOK_SECRET))).isEqualTo(200);
        assertThat(webhook(event, StripeStub.signature(event, StripeStub.WEBHOOK_SECRET))).isEqualTo(200);

        assertThat(tier(ana)).isEqualTo("PRO");
        assertThat(STRIPE.calls("GET", "/v1/subscriptions/sub_1")).hasSize(1);
    }

    @Test
    void aWebhookWithoutStripesValidSignatureIsRefusedAndChangesNothing() throws Exception {
        String customer = customerOf(ana);
        STRIPE.subscription("sub_1", customer, "active", "pro_monthly", "month", 1_800_000_000L, false, 1);
        String event = StripeStub.event("evt_forged", "customer.subscription.created", "sub_1", customer);

        assertThat(webhook(event, StripeStub.signature(event, "whsec_someone_else"))).isEqualTo(400);
        assertThat(webhook(event, null)).isEqualTo(400);
        assertThat(webhook(event.replace("sub_1", "sub_2"), StripeStub.signature(event, StripeStub.WEBHOOK_SECRET)))
                .isEqualTo(400);

        assertThat(tier(ana)).isEqualTo("FREE");
    }

    @Test
    void eventsAboutOtherThingsOrUnknownCustomersAreAcceptedAndIgnored() throws Exception {
        String other = StripeStub.event("evt_other", "invoice.created", "in_1", "cus_x");
        assertThat(webhook(other, StripeStub.signature(other, StripeStub.WEBHOOK_SECRET))).isEqualTo(200);
        STRIPE.subscription("sub_9", "cus_nobody", "active", "pro_monthly", "month", 1_800_000_000L, false, 1);
        String stranger = StripeStub.event("evt_stranger", "customer.subscription.created", "sub_9", "cus_nobody");
        assertThat(webhook(stranger, StripeStub.signature(stranger, StripeStub.WEBHOOK_SECRET))).isEqualTo(200);
        assertThat(tier(ana)).isEqualTo("FREE");
    }

    @Test
    void theOldPlanSwitchNoLongerChangesThePlan() throws Exception {
        JsonNode error = api.post(ana, "/api/me/plan", "{\"tier\":\"PRO\"}", 403);
        assertThat(error.get("message").asString()).contains("checkout");
        assertThat(tier(ana)).isEqualTo("FREE");
    }

    // --- Managing the subscription ---

    @Test
    void cancellingKeepsProUntilThePeriodEndsThenTheAccountIsFree() throws Exception {
        String customer = customerOf(ana);
        stripeSays("sub_1", customer, "active", "pro_monthly", false);

        stripeSays("sub_1", customer, "active", "pro_monthly", true);
        assertThat(tier(ana)).isEqualTo("PRO");
        assertThat(api.get(ana, "/api/billing", 200).get("cancelAtPeriodEnd").asBoolean()).isTrue();

        stripeSays("sub_1", customer, "canceled", "pro_monthly", true);
        assertThat(tier(ana)).isEqualTo("FREE");
        assertThat(api.get(ana, "/api/billing", 200).get("plan").isNull()).isTrue();
    }

    @Test
    void aFailedPaymentKeepsProMeanwhileAndIsShownThenUnpaidMeansFree() throws Exception {
        String customer = customerOf(ana);
        stripeSays("sub_1", customer, "active", "pro_yearly", false);

        stripeSays("sub_1", customer, "past_due", "pro_yearly", false);
        assertThat(tier(ana)).isEqualTo("PRO");
        assertThat(api.get(ana, "/api/billing", 200).get("paymentProblem").asBoolean()).isTrue();

        stripeSays("sub_1", customer, "unpaid", "pro_yearly", false);
        assertThat(tier(ana)).isEqualTo("FREE");
    }

    @Test
    void thePortalOpensForTheLearnersOwnCustomerAndComesBackToSettings() throws Exception {
        api.post(ana, "/api/billing/portal", "{}", 400);
        String customer = customerOf(ana);

        JsonNode portal = api.post(ana, "/api/billing/portal", "{}", 200);

        assertThat(portal.get("url").asString()).isEqualTo("https://billing.stripe.test/p_1");
        assertThat(STRIPE.calls("POST", "/v1/billing_portal/sessions").getFirst().form())
                .containsEntry("customer", customer)
                .containsEntry("return_url", "https://site.test/settings/subscription");
    }

    // --- Classroom ---

    @Test
    void aTeacherPaysPerStudentAndTheCountFollowsJoinsAndLeaves() throws Exception {
        checkout(ana, "classroom_monthly", 200);
        assertThat(STRIPE.calls("POST", "/v1/checkout/sessions").getFirst().form())
                .containsEntry("line_items[0][price]", "price_classroom_monthly")
                .containsEntry("line_items[0][quantity]", "1");
        String customer = STRIPE.calls("POST", "/v1/checkout/sessions").getFirst().form().get("customer");
        stripeSays("sub_c", customer, "active", "classroom_monthly", false);
        assertThat(tier(ana)).isEqualTo("CLASSROOM");

        JsonNode cls = api.post(ana, "/api/classes", "{\"name\":\"Clase\",\"language\":\"es\"}", 201);
        String join = "{\"code\":\"" + cls.get("joinCode").asString() + "\"}";
        String ben = api.signup();
        String eva = api.signup();
        api.post(ben, "/api/classes/join", join, 200);
        api.post(eva, "/api/classes/join", join, 200);
        assertThat(STRIPE.calls("POST", "/v1/subscription_items/si_sub_c").getLast().form())
                .containsEntry("quantity", "2");
        assertThat(api.get(ben, "/api/me", 200).get("plan").get("effectiveTier").asString()).isEqualTo("PRO");

        long benId = api.get(ben, "/api/me", 200).get("id").asLong();
        api.delete(ana, "/api/classes/" + cls.get("id").asLong() + "/members/" + benId, 204);
        assertThat(STRIPE.calls("POST", "/v1/subscription_items/si_sub_c").getLast().form())
                .containsEntry("quantity", "1");

        stripeSays("sub_c", customer, "canceled", "classroom_monthly", false);
        assertThat(api.get(eva, "/api/me", 200).get("plan").get("effectiveTier").asString()).isEqualTo("FREE");
    }

    // --- Accounts ---

    @Test
    void deletingTheAccountCancelsItsSubscriptionFirst() throws Exception {
        String customer = customerOf(ana);
        stripeSays("sub_1", customer, "active", "pro_monthly", false);
        String email = api.get(ana, "/api/me", 200).get("email").asString();

        STRIPE.fail(true);
        assertThat(deleteAccount(ana, email)).isEqualTo(503);
        api.get(ana, "/api/me", 200);

        STRIPE.fail(false);
        assertThat(deleteAccount(ana, email)).isEqualTo(204);
        assertThat(STRIPE.calls("DELETE", "/v1/subscriptions/sub_1")).isNotEmpty();
        api.get(ana, "/api/me", 401);
    }

    private int deleteAccount(String token, String email) throws Exception {
        return mvc.perform(delete("/api/me").header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"confirmEmail\":\"" + email + "\"}")).andReturn().getResponse().getStatus();
    }
}
