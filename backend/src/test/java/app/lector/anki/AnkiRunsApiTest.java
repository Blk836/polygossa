package app.lector.anki;

import static app.lector.anki.AnkiApi.DECK;
import static app.lector.anki.AnkiApi.deck;
import static app.lector.anki.AnkiApi.fresh;
import static app.lector.anki.AnkiApi.mature;
import static app.lector.anki.AnkiApi.young;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class AnkiRunsApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    AnkiApi anki;
    String me;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        anki = new AnkiApi(api, json);
        me = api.signupPro();
        anki.chooseSpanish(me);
    }

    @Test
    void myDeckChoicesAreKeptAndReplaced() throws Exception {
        anki.chooseDecks(me, List.of(deck(DECK, "es"), deck(7, "fr")), 200);
        JsonNode decks = api.get(me, "/api/anki/decks", 200).get("decks");
        assertThat(decks).hasSize(2);
        assertThat(decks.get(0).get("ankiDeckId").asLong()).isEqualTo(DECK);
        assertThat(decks.get(0).get("wordField").asString()).isEqualTo("Word");
        assertThat(decks.get(0).get("meaningField").asString()).isEqualTo("Definition");
        assertThat(decks.get(0).get("language").asString()).isEqualTo("es");
        assertThat(decks.get(0).has("firstSyncedAt")).isFalse();
        anki.chooseDecks(me, List.of(deck(7, "de")), 200);
        decks = api.get(me, "/api/anki/decks", 200).get("decks");
        assertThat(decks).hasSize(1);
        assertThat(decks.get(0).get("language").asString()).isEqualTo("de");
    }

    @Test
    void eachNoteTypesChoiceIsKeptWithItsDeck() throws Exception {
        Map<String, Object> mixed = new java.util.LinkedHashMap<>(deck(DECK, "es"));
        mixed.put("noteTypes", List.of(
                Map.of("modelId", 1_600_000_000_001L, "name", "Basic", "wordField", "Back", "meaningField", "Front"),
                Map.of("modelId", 1_600_000_000_002L, "name", "Cloze")));
        anki.chooseDecks(me, List.of(mixed), 200);
        JsonNode types = api.get(me, "/api/anki/decks", 200).get("decks").get(0).get("noteTypes");
        assertThat(types).hasSize(2);
        assertThat(types.get(0).get("modelId").asLong()).isEqualTo(1_600_000_000_001L);
        assertThat(types.get(0).get("name").asString()).isEqualTo("Basic");
        assertThat(types.get(0).get("wordField").asString()).isEqualTo("Back");
        assertThat(types.get(0).get("meaningField").asString()).isEqualTo("Front");
        assertThat(types.get(1).get("name").asString()).isEqualTo("Cloze");
        assertThat(types.get(1).has("wordField")).isFalse();
        mixed.put("noteTypes", List.of(Map.of("modelId", 1_600_000_000_003L, "name", "Vocab", "wordField", "Word")));
        anki.chooseDecks(me, List.of(mixed), 200);
        types = api.get(me, "/api/anki/decks", 200).get("decks").get(0).get("noteTypes");
        assertThat(types).extracting(t -> t.get("name").asString()).containsExactly("Vocab");
    }

    @Test
    void aDeckSavedWithoutNoteTypesListsNone() throws Exception {
        assertThat(api.get(me, "/api/anki/decks", 200).get("decks").get(0).get("noteTypes")).isEmpty();
    }

    @Test
    void invalidNoteTypeChoicesAreRejected() throws Exception {
        Map<String, Object> twice = new java.util.LinkedHashMap<>(deck(DECK, "es"));
        twice.put("noteTypes", List.of(Map.of("modelId", 5, "name", "A"), Map.of("modelId", 5, "name", "B")));
        anki.chooseDecks(me, List.of(twice), 400);
        Map<String, Object> noName = new java.util.LinkedHashMap<>(deck(DECK, "es"));
        noName.put("noteTypes", List.of(Map.of("modelId", 5, "name", " ")));
        anki.chooseDecks(me, List.of(noName), 400);
        Map<String, Object> longField = new java.util.LinkedHashMap<>(deck(DECK, "es"));
        longField.put("noteTypes", List.of(Map.of("modelId", 5, "name", "A", "wordField", "x".repeat(101))));
        anki.chooseDecks(me, List.of(longField), 400);
    }

    @Test
    void theResultCountsCardsLeftOutByTheirNoteType() throws Exception {
        long run = anki.start(me, true);
        anki.send(me, run, DECK, List.of(mature("perro")), 200);
        JsonNode done = api.post(me, "/api/anki/runs/" + run + "/finish",
                "{\"ankiDeckIds\":[" + DECK + "],\"skippedNoteType\":40,\"waitingNoteType\":7}", 200);
        assertThat(done.get("skippedNoteType").asInt()).isEqualTo(40);
        assertThat(done.get("waitingNoteType").asInt()).isEqualTo(7);
        JsonNode plain = anki.sync(me, mature("gato"));
        assertThat(plain.get("skippedNoteType").asInt()).isZero();
        assertThat(plain.get("waitingNoteType").asInt()).isZero();
    }

    @Test
    void invalidDeckChoicesAreRejected() throws Exception {
        Map<String, Object> blank = new java.util.LinkedHashMap<>(deck(1, "es"));
        blank.put("wordField", " ");
        anki.chooseDecks(me, List.of(blank), 400);
        Map<String, Object> noLanguage = new java.util.LinkedHashMap<>(deck(1, "es"));
        noLanguage.remove("language");
        anki.chooseDecks(me, List.of(noLanguage), 400);
        anki.chooseDecks(me, List.of(deck(1, "es"), deck(1, "fr")), 400);
        List<Map<String, Object>> many = new ArrayList<>();
        for (int i = 0; i < 51; i++) {
            many.add(deck(i, "es"));
        }
        anki.chooseDecks(me, many, 400);
        assertThat(api.get(me, "/api/anki/decks", 200).get("decks")).hasSize(1);
    }

    @Test
    void thePreviewChangesNothing() throws Exception {
        anki.save(me, "perro", "learning");
        JsonNode preview = anki.preview(me, mature("perro"), mature("mesa"), young("silla"), fresh("libro"), mature(""));
        assertThat(preview.get("dryRun").asBoolean()).isTrue();
        assertThat(AnkiApi.counts(preview)).containsAllEntriesOf(Map.of(
                "becameKnown", 1, "addedKnown", 1, "addedLearning", 1, "skippedEmpty", 1, "leaveReview", 1));
        long run = preview.get("id").asLong();
        assertThat(anki.words(me, run, "became_known")).containsExactly("perro");
        assertThat(anki.words(me, run, "added_known")).containsExactly("mesa");
        assertThat(anki.words(me, run, "added_learning")).containsExactly("silla");
        assertThat(anki.words(me, run, "leave_review")).containsExactly("perro");
        assertThat(anki.statuses(me, "es")).containsExactlyEntriesOf(Map.of("perro", "learning"));
        assertThat(api.get(me, "/api/anki/decks", 200).get("decks").get(0).has("firstSyncedAt")).isFalse();
        assertThat(anki.sync(me, mature("perro")).get("becameKnown").asInt()).isEqualTo(1);
    }

    @Test
    void aPreviewCountsThePlanLimitAcrossBatches() throws Exception {
        String free = api.signup();
        anki.chooseSpanish(free);
        long run = anki.start(free, true);
        List<Map<String, Object>> cards = new ArrayList<>();
        for (int i = 0; i < 300; i++) {
            cards.add(young("a" + i));
        }
        anki.send(free, run, DECK, cards, 200);
        cards.replaceAll(c -> young("b" + c.get("word")));
        anki.send(free, run, DECK, cards, 200);
        JsonNode done = anki.finish(free, run, List.of(DECK));
        assertThat(AnkiApi.counts(done)).containsAllEntriesOf(Map.of("addedLearning", 500, "overLimit", 100));
    }

    @Test
    void theLatestResultAndItsWordsCanBeSeen() throws Exception {
        api.get(me, "/api/anki/runs/latest", 204);
        JsonNode run = anki.sync(me, mature("perro"), young("gato"));
        anki.preview(me, mature("casa"));
        JsonNode latest = api.get(me, "/api/anki/runs/latest", 200);
        assertThat(latest.get("id").asLong()).isEqualTo(run.get("id").asLong());
        assertThat(latest.get("addedKnown").asInt()).isEqualTo(1);
        assertThat(latest.get("finishedAt").isNull()).isFalse();
        assertThat(anki.words(me, run.get("id").asLong(), "added_learning")).containsExactly("gato");
        api.get(me, "/api/anki/runs/" + run.get("id").asLong() + "/words?outcome=nonsense", 400);
    }

    @Test
    void oneSyncAtATime() throws Exception {
        long first = anki.start(me, false);
        api.post(me, "/api/anki/runs", "{\"dryRun\":false}", 409);
        api.post(me, "/api/anki/runs", "{\"dryRun\":true}", 409);
        anki.finish(me, first, List.of(DECK));
        anki.start(me, false);
    }

    @Test
    void batchesAreCheckedAndAFinishedRunTakesNoMore() throws Exception {
        long run = anki.start(me, false);
        anki.send(me, run, 999, List.of(mature("perro")), 400);
        List<Map<String, Object>> tooMany = new ArrayList<>();
        for (int i = 0; i < 1001; i++) {
            tooMany.add(mature("w" + i));
        }
        anki.send(me, run, DECK, tooMany, 400);
        anki.send(me, run, DECK, List.of(AnkiApi.card("perro", 7, 1, null)), 400);
        anki.finish(me, run, List.of(DECK));
        anki.send(me, run, DECK, List.of(mature("perro")), 409);
    }

    @Test
    void othersCantSeeOrUseMyRunsOrDecks() throws Exception {
        long run = anki.sync(me, mature("perro")).get("id").asLong();
        String other = api.signupPro();
        api.get(other, "/api/anki/runs/" + run + "/words?outcome=added_known", 404);
        anki.send(other, run, DECK, List.of(mature("gato")), 404);
        api.post(other, "/api/anki/runs/" + run + "/finish", "{\"ankiDeckIds\":[]}", 404);
        assertThat(api.get(other, "/api/anki/decks", 200).get("decks")).isEmpty();
        api.get(other, "/api/anki/runs/latest", 204);
        anki.chooseDecks(other, List.of(deck(42, "es")), 200);
        long theirs = anki.start(other, false);
        anki.send(other, theirs, DECK, List.of(mature("gato")), 400);
    }

    @Test
    void aSyncCutOffByAnkiClosingStopsAtOnceAndKeepsWhatItSent() throws Exception {
        long run = anki.start(me, false);
        anki.send(me, run, DECK, List.of(mature("perro")), 200);
        JsonNode stopped = api.post(me, "/api/anki/runs/" + run + "/stop", "", 200);
        assertThat(stopped.get("state").asString()).isEqualTo("stopped");
        assertThat(api.get(me, "/api/anki/runs/latest", 200).get("state").asString()).isEqualTo("stopped");
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "known");
        anki.send(me, run, DECK, List.of(mature("gato")), 409);
        api.post(me, "/api/anki/runs/" + run + "/stop", "", 409);
        anki.start(me, false);
        api.post(api.signupPro(), "/api/anki/runs/" + run + "/stop", "", 404);
    }

    @Test
    void myAccountSaysWhetherAnkiIsConnected() throws Exception {
        assertThat(api.get(me, "/api/me", 200).get("ankiConnected").asBoolean()).isTrue();
        api.delete(me, "/api/anki/decks", 204);
        assertThat(api.get(me, "/api/me", 200).get("ankiConnected").asBoolean()).isFalse();
        anki.chooseDecks(me, List.of(deck(3, "fr")), 200);
        assertThat(api.get(me, "/api/me", 200).get("ankiConnected").asBoolean()).isTrue();
        assertThat(api.get(api.signupPro(), "/api/me", 200).get("ankiConnected").asBoolean()).isFalse();
    }

    @Test
    void aSyncWithoutDecksIsRejected() throws Exception {
        String other = api.signupPro();
        api.post(other, "/api/anki/runs", "{\"dryRun\":false}", 400);
    }
}
