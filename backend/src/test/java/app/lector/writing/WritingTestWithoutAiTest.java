package app.lector.writing;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** With no AI configured, tests still run and the writing is kept; it is graded once AI is set up. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:writingnoai;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=false",
        "app.openai.api-key="
})
@AutoConfigureMockMvc
class WritingTestWithoutAiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Test
    void writingIsSavedUngradedWithAnExplanation() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String user = api.signupPro();
        long id = api.post(user, "/api/writing/tests", "{\"language\":\"fr\",\"level\":\"A1\"}", 201).get("id").asLong();
        JsonNode saved = api.post(user, "/api/writing/tests/" + id + "/submit",
                "{\"content\":\"" + "mot ".repeat(30).strip() + "\"}", 200);
        assertThat(saved.get("status").asString()).isEqualTo("ungraded");
        assertThat(saved.get("gradeError").asString()).contains("OPENAI_API_KEY");
        assertThat(saved.get("wordCount").asInt()).isEqualTo(30);
    }
}
