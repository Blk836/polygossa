package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** POST /api/texts/{id}/progress: how far the viewer has read, shown on Library/Explore cards and used to resume. */
@ApiTest
class ReadingProgressApiTest {

    // Ten words; word n is token 2n (each followed by a space, the last by "."), so token 19 is the final ".".
    private static final String CONTENT = "uno dos tres cuatro cinco seis siete ocho nueve diez.";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String token;
    long text;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signup();
        text = api.createText(token, "es", CONTENT, true);
    }

    private JsonNode save(String user, long id, String body, int status) throws Exception {
        return api.post(user, "/api/texts/" + id + "/progress", body, status);
    }

    private JsonNode at(int position) throws Exception {
        return save(token, text, "{\"position\":" + position + "}", 200);
    }

    /** The text's summary in the owner's own list (Library). */
    private JsonNode mine(String user) throws Exception {
        for (JsonNode t : api.get(user, "/api/texts", 200)) {
            if (t.get("id").asLong() == text) {
                return t;
            }
        }
        throw new AssertionError("text not listed");
    }

    /** The text's summary in the public library (Explore search). */
    private JsonNode explore(String user) throws Exception {
        for (JsonNode t : api.get(user, "/api/library?language=es&size=50", 200).get("items")) {
            if (t.get("id").asLong() == text) {
                return t;
            }
        }
        throw new AssertionError("text not in the library");
    }

    private JsonNode detail(String user) throws Exception {
        return api.get(user, "/api/texts/" + text, 200).get("text");
    }

    @Test
    void anUnstartedTextHasNoProgress() throws Exception {
        assertThat(mine(token).has("progress")).isFalse();
        assertThat(explore(token).has("progress")).isFalse();
        assertThat(detail(token).has("progress")).isFalse();
    }

    @Test
    void savingAPositionShowsThePercentReadEverywhere() throws Exception {
        JsonNode saved = at(8); // the 5th word: 4 of 10 words lie before it
        assertThat(saved.get("position").asInt()).isEqualTo(8);
        assertThat(saved.get("percent").asInt()).isEqualTo(40);
        assertThat(saved.get("completed").asBoolean()).isFalse();
        for (JsonNode summary : new JsonNode[] {mine(token), explore(token), detail(token)}) {
            assertThat(summary.get("progress").get("position").asInt()).isEqualTo(8);
            assertThat(summary.get("progress").get("percent").asInt()).isEqualTo(40);
            assertThat(summary.get("progress").get("completed").asBoolean()).isFalse();
        }
    }

    @Test
    void openingTheFirstPageCountsAsStartedAtZero() throws Exception {
        at(0);
        assertThat(mine(token).get("progress").get("percent").asInt()).isZero();
    }

    @Test
    void thePercentIsTheFurthestPointReachedButResumeIsWhereReadingStopped() throws Exception {
        at(14);
        JsonNode back = at(2);
        assertThat(back.get("position").asInt()).isEqualTo(2);
        assertThat(back.get("percent").asInt()).isEqualTo(70);
        assertThat(detail(token).get("progress").get("position").asInt()).isEqualTo(2);
    }

    @Test
    void percentRoundsDown() throws Exception {
        String content = "a b c d e f.";
        long six = api.createText(token, "es", content, false);
        JsonNode r = save(token, six, "{\"position\":2}", 200); // 1 of 6 words before: 16.7%
        assertThat(r.get("percent").asInt()).isEqualTo(16);
    }

    @Test
    void finishingTheLessonMarksItCompletedAtFullProgress() throws Exception {
        at(6);
        api.post(token, "/api/texts/" + text + "/complete", "", 200);
        JsonNode p = mine(token).get("progress");
        assertThat(p.get("completed").asBoolean()).isTrue();
        assertThat(p.get("percent").asInt()).isEqualTo(100);
        assertThat(p.get("position").asInt()).isEqualTo(6);
    }

    @Test
    void finishingWithoutAnySavedPositionStillCompletes() throws Exception {
        api.post(token, "/api/texts/" + text + "/complete", "", 200);
        JsonNode p = detail(token).get("progress");
        assertThat(p.get("completed").asBoolean()).isTrue();
        assertThat(p.get("percent").asInt()).isEqualTo(100);
        assertThat(p.get("position").asInt()).isZero();
    }

    @Test
    void reReadingAFinishedTextKeepsItFinishedAndMovesTheResumePoint() throws Exception {
        api.post(token, "/api/texts/" + text + "/complete", "", 200);
        JsonNode r = at(4);
        assertThat(r.get("completed").asBoolean()).isTrue();
        assertThat(r.get("percent").asInt()).isEqualTo(100);
        assertThat(r.get("position").asInt()).isEqualTo(4);
    }

    @Test
    void aPositionPastTheEndIsCutToTheLastToken() throws Exception {
        JsonNode r = at(999);
        assertThat(r.get("position").asInt()).isEqualTo(19);
        assertThat(r.get("percent").asInt()).isEqualTo(100);
        assertThat(r.get("completed").asBoolean()).isFalse();
    }

    @Test
    void aTextWithoutWordsHasZeroPercent() throws Exception {
        long none = api.createText(token, "es", "...", false);
        assertThat(save(token, none, "{\"position\":1}", 200).get("percent").asInt()).isZero();
    }

    @Test
    void rejectsAnInvalidPosition() throws Exception {
        save(token, text, "{\"position\":-1}", 400);
        save(token, text, "{}", 400);
        assertThat(mine(token).has("progress")).isFalse();
    }

    @Test
    void returnsNotFoundForATextTheUserCannotRead() throws Exception {
        String other = api.signup();
        long theirs = api.createText(other, "es", "Adiós amigo.", false);
        save(token, theirs, "{\"position\":0}", 404);
    }

    @Test
    void progressIsPerUser() throws Exception {
        at(10);
        String other = api.signup();
        assertThat(explore(other).has("progress")).isFalse();
        assertThat(detail(other).has("progress")).isFalse();
        JsonNode theirs = save(other, text, "{\"position\":4}", 200);
        assertThat(theirs.get("percent").asInt()).isEqualTo(20);
        assertThat(explore(token).get("progress").get("percent").asInt()).isEqualTo(50);
    }

    @Test
    void shelvesAndBookmarksCarryProgressToo() throws Exception {
        at(10);
        api.send(MockMvcRequestBuilders.put("/api/library/" + text + "/bookmark"), token, 204);
        JsonNode bookmark = api.get(token, "/api/library/bookmarks", 200).get(0);
        assertThat(bookmark.get("progress").get("percent").asInt()).isEqualTo(50);
        boolean found = false;
        for (JsonNode shelf : api.get(token, "/api/library/shelves?language=es", 200)) {
            for (JsonNode item : shelf.get("items")) {
                if (item.get("id").asLong() == text) {
                    found = true;
                    assertThat(item.get("progress").get("percent").asInt()).isEqualTo(50);
                }
            }
        }
        assertThat(found).isTrue();
    }

    @Test
    void deletingATextRemovesItsProgress() throws Exception {
        at(4);
        String other = api.signup();
        save(other, text, "{\"position\":2}", 200);
        api.send(MockMvcRequestBuilders.delete("/api/texts/" + text), token, 204);
        api.get(token, "/api/texts/" + text, 404);
    }
}
