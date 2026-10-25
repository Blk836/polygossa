package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.writing.OpenAiStub;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=importcategorynoai",
        "app.seed-samples=false",
        "app.openai.api-key="
})
@AutoConfigureMockMvc
class ImportCategoryWithoutAiTest {

    private static final OpenAiStub AI = startAi();

    private static OpenAiStub startAi() {
        try {
            return new OpenAiStub();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void ai(DynamicPropertyRegistry registry) {
        registry.add("app.openai.base-url", AI::baseUrl);
    }

    @AfterAll
    static void stop() {
        AI.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Test
    void importsAreFiledUnderOtherWithoutCallingTheAi() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String user = api.signupPro();
        AI.reply("{\"category\":\"food\"}");
        String category = api.post(user, "/api/texts",
                "{\"title\":\"Pain\",\"language\":\"fr\",\"content\":\"Farine.\",\"isPublic\":false}", 201)
                .get("category").asString();
        assertThat(category).isEqualTo("other");
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void importsGetTheFormulasLevelWithoutCallingTheAi() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String user = api.signupPro();
        AI.reply("{\"level\":\"C2\"}");
        String level = api.post(user, "/api/texts",
                "{\"title\":\"Chat\",\"language\":\"fr\",\"content\":\"Le chat mange.\",\"isPublic\":false}", 201)
                .get("cefrLevel").asString();
        assertThat(level).isEqualTo("A1");
        assertThat(AI.requests()).isEmpty();
    }

    @Test
    void sharedImportsAreNotChecked() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String user = api.signupPro();
        AI.reply("{\"appropriate\":false,\"reason\":\"x\"}");
        boolean shared = api.post(user, "/api/texts",
                "{\"title\":\"Pain\",\"language\":\"fr\",\"content\":\"Farine.\",\"isPublic\":true}", 201)
                .get("isPublic").asBoolean();
        assertThat(shared).isTrue();
        assertThat(AI.requests()).isEmpty();
    }
}
