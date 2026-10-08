package app.lector.billing;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** stripe-billing.feature, "Local runs and tests": with no Stripe keys, the plan switch works as before. */
@ApiTest
class BillingOffApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Test
    void withoutStripeBillingIsOffAndThePlanSwitchStillWorks() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();

        JsonNode billing = api.get(token, "/api/billing", 200);
        assertThat(billing.get("enabled").asBoolean()).isFalse();
        api.post(token, "/api/billing/checkout", "{\"plan\":\"pro_monthly\"}", 404);
        api.post(token, "/api/billing/portal", "{}", 404);

        api.post(token, "/api/me/plan", "{\"tier\":\"PRO\"}", 200);
        assertThat(api.get(token, "/api/me", 200).get("plan").get("tier").asString()).isEqualTo("PRO");
    }
}
