package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class WordNotesTagsApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;
    private String token;
    private long perro;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signupPro();
        perro = save("perro", "");
    }

    private long save(String term, String extra) throws Exception {
        return api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"" + term + "\",\"definition\":\"d\""
                + extra + "}", 201).get("id").asLong();
    }

    private JsonNode patch(long id, String body, int status) throws Exception {
        return api.patch(token, "/api/vocabulary/" + id, body, status);
    }

    private JsonNode get(long id) throws Exception {
        return api.get(token, "/api/vocabulary/" + id, 200);
    }

    private static java.util.List<String> tags(JsonNode entry) {
        return entry.path("tags").valueStream().map(JsonNode::asString).toList();
    }

    @Test
    void addingAndClearingANote() throws Exception {
        JsonNode e = patch(perro, "{\"note\":\"Sounds like 'pear-o': a dog eating a pear\"}", 200);
        assertThat(e.get("note").asString()).isEqualTo("Sounds like 'pear-o': a dog eating a pear");
        assertThat(e.get("definition").asString()).isEqualTo("d");
        assertThat(patch(perro, "{\"note\":\"\"}", 200).has("note")).isFalse();
        assertThat(get(perro).has("note")).isFalse();
    }

    @Test
    void aLongNoteIsCut() throws Exception {
        assertThat(patch(perro, "{\"note\":\"" + "x".repeat(2500) + "\"}", 200).get("note").asString()).hasSize(2000);
    }

    @Test
    void tagsAreNormalized() throws Exception {
        JsonNode e = patch(perro, "{\"tags\":[\"Animals\",\" animals \",\"food-words\",\"A1\"]}", 200);
        assertThat(tags(e)).containsExactly("animals", "food-words", "a1");
        assertThat(tags(get(perro))).containsExactly("animals", "food-words", "a1");
    }

    @Test
    void invalidTagsAreRefused() throws Exception {
        patch(perro, "{\"tags\":[\"ok\"]}", 200);
        StringBuilder eleven = new StringBuilder("[");
        for (int i = 0; i < 11; i++) {
            eleven.append(i == 0 ? "" : ",").append("\"t").append(i).append('"');
        }
        for (String bad : new String[] {"[\"two words\"]", "[\"a,b\"]", "[\"\"]",
                "[\"" + "a".repeat(31) + "\"]", eleven + "]"}) {
            JsonNode error = patch(perro, "{\"tags\":" + bad + ",\"note\":\"should not save\"}", 400);
            assertThat(error.get("message").asString()).containsIgnoringCase("tag");
            assertThat(tags(get(perro))).containsExactly("ok");
            assertThat(get(perro).has("note")).isFalse();
        }
    }

    @Test
    void removingAllTagsAndKeepingThemWhenLeftOut() throws Exception {
        patch(perro, "{\"tags\":[\"animals\"]}", 200);
        patch(perro, "{\"definition\":\"dog\"}", 200);
        assertThat(tags(get(perro))).containsExactly("animals");
        assertThat(tags(patch(perro, "{\"tags\":[]}", 200))).isEmpty();
    }

    @Test
    void savingFromTheReaderWithANoteAndTags() throws Exception {
        long gato = save("gato", ",\"note\":\"meow\",\"tags\":[\"Pets\"]");
        JsonNode e = get(gato);
        assertThat(e.get("note").asString()).isEqualTo("meow");
        assertThat(tags(e)).containsExactly("pets");
    }

    @Test
    void filteringByTagAndListingMyTags() throws Exception {
        patch(perro, "{\"tags\":[\"animals\"]}", 200);
        long gato = save("gato", ",\"tags\":[\"animals\",\"pets\"]");
        save("comer", "");
        String other = api.signupPro();
        api.post(other, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"vaca\",\"tags\":[\"farm\"]}", 201);

        JsonNode animals = api.get(token, "/api/vocabulary?language=es&tag=animals", 200);
        assertThat(animals.get("items").valueStream().map(n -> n.get("id").asLong())).containsExactlyInAnyOrder(perro, gato);
        assertThat(api.get(token, "/api/vocabulary?language=es&tag=anim", 200).get("total").asLong()).isZero();
        assertThat(api.get(token, "/api/vocabulary?language=es&tag=Animals", 200).get("total").asLong()).isEqualTo(2);

        JsonNode mine = api.get(token, "/api/vocabulary/tags?language=es", 200);
        assertThat(mine.valueStream().map(n -> n.get("tag").asString() + "=" + n.get("count").asInt()))
                .containsExactly("animals=2", "pets=1");
        assertThat(api.get(token, "/api/vocabulary/tags?language=fr", 200).isEmpty()).isTrue();
    }

    @Test
    void searchCoversNotes() throws Exception {
        patch(perro, "{\"note\":\"Pear!\"}", 200);
        save("gato", "");
        JsonNode found = api.get(token, "/api/vocabulary?language=es&q=pear", 200);
        assertThat(found.get("items").valueStream().map(n -> n.get("term").asString())).containsExactly("perro");
    }

    @Test
    void theNoteIsOnTheReviewCard() throws Exception {
        patch(perro, "{\"note\":\"a dog eating a pear\",\"status\":\"learning\"}", 200);
        JsonNode queue = api.get(token, "/api/review/queue?language=es&ahead=true", 200);
        JsonNode card = queue.valueStream().filter(c -> c.get("id").asLong() == perro).findFirst().orElseThrow();
        assertThat(card.get("notes").asString()).isEqualTo("a dog eating a pear");
    }
}
