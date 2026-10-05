package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Characterization of GET /api/dashboard aggregation. */
@ApiTest
class DashboardApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Test
    void aggregatesStatusesSessionsAndGrowthPerLanguage() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        long text = api.createText(token, "es", "Uno dos.", false);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"uno\",\"status\":\"known\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"dos\",\"status\":\"ignored\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"tres\"}", 201);
        api.post(token, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"un\"}", 201);
        long session = api.post(token, "/api/sessions", "{\"textId\":" + text + "}", 201).get("id").asLong();
        api.post(token, "/api/sessions/" + session + "/heartbeat", "{\"seconds\":3}", 200);
        long german = api.createText(token, "de", "Hallo.", false);
        api.post(token, "/api/sessions", "{\"textId\":" + german + "}", 201);

        JsonNode d = api.get(token, "/api/dashboard?days=7", 200);
        JsonNode es = null;
        JsonNode fr = null;
        JsonNode de = null;
        for (JsonNode l : d.get("languages")) {
            if ("es".equals(l.get("language").asString())) {
                es = l;
            } else if ("fr".equals(l.get("language").asString())) {
                fr = l;
            } else if ("de".equals(l.get("language").asString())) {
                de = l;
            }
        }
        assertThat(es).isNotNull();
        assertThat(es.get("known").asLong()).isEqualTo(1);
        assertThat(es.get("ignored").asLong()).isEqualTo(1);
        assertThat(es.get("learning").asLong()).isEqualTo(1);
        assertThat(es.get("sessions").asLong()).isEqualTo(1);
        assertThat(es.get("readingSeconds").asLong()).isEqualTo(3);
        assertThat(fr.get("learning").asLong()).isEqualTo(1);
        assertThat(fr.get("sessions").asLong()).isZero();
        assertThat(de.get("sessions").asLong()).as("a language with sessions but no words").isEqualTo(1);
        assertThat(de.get("known").asLong()).isZero();
        assertThat(d.get("totalSessions").asLong()).isEqualTo(2);
        assertThat(d.get("totalReadingSeconds").asLong()).isEqualTo(3);
        assertThat(d.get("textsImported").asLong()).isEqualTo(2);
        assertThat(d.get("growth")).hasSize(1);
        assertThat(d.get("growth").get(0).get("known")).hasSize(7);
        assertThat(d.get("growth").get(0).get("known").get(6).get("value").asLong()).isEqualTo(1);
        assertThat(d.get("readingMinutesByDay")).hasSize(30);
        assertThat(d.get("readingMinutesByDay").get(29).get("value").asLong()).as("3 seconds rounds to 0 minutes").isZero();
        assertThat(d.get("review").isNull()).as("free users get no review stats").isTrue();
    }
}
