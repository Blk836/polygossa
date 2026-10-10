package app.lector.anki;

import static app.lector.anki.AnkiApi.card;
import static app.lector.anki.AnkiApi.fresh;
import static app.lector.anki.AnkiApi.mature;
import static app.lector.anki.AnkiApi.young;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import app.lector.token.Language;
import app.lector.user.UserRepository;
import app.lector.vocab.VocabularyRepository;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class AnkiSyncApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    VocabularyRepository vocabulary;

    @Autowired
    UserRepository users;

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

    private long myId() throws Exception {
        return api.get(me, "/api/me", 200).get("id").asLong();
    }

    @Test
    void ankisStateBecomesOurs() throws Exception {
        anki.save(me, "perro", "learning");
        anki.save(me, "gato", "learning");
        anki.save(me, "casa", "learning");
        JsonNode run = anki.sync(me, mature("perro"), young("gato"), fresh("casa"),
                mature("mesa"), young("silla"), fresh("libro"));
        assertThat(anki.statuses(me, "es")).containsExactlyInAnyOrderEntriesOf(Map.of(
                "perro", "known", "gato", "learning", "casa", "learning", "mesa", "known", "silla", "learning"));
        assertThat(AnkiApi.counts(run)).containsAllEntriesOf(Map.of(
                "cards", 6, "becameKnown", 1, "addedKnown", 1, "addedLearning", 1, "leaveReview", 3));
        assertThat(run.get("state").asString()).isEqualTo("done");
    }

    @Test
    void ankiNeverLowersAWord() throws Exception {
        anki.save(me, "maison", "known");
        anki.save(me, "chat", "ignored");
        anki.save(me, "perro", "ignored");
        anki.sync(me, young("maison"), young("chat"), mature("perro"));
        assertThat(anki.statuses(me, "es")).containsExactlyInAnyOrderEntriesOf(Map.of(
                "maison", "known", "chat", "ignored", "perro", "ignored"));
    }

    @Test
    void myOwnChangeSticksUntilAnkiHasNews() throws Exception {
        anki.sync(me, mature("perro"));
        anki.setStatus(me, "perro", "learning");
        anki.sync(me, mature("perro"));
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "learning");
        anki.sync(me, card("perro", 3, -600, null));
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "learning");
        anki.sync(me, mature("perro"));
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "known");
    }

    @Test
    void suspendedOrBuriedCardsCountByTheirReviews() throws Exception {
        anki.sync(me, card("perro", 2, 60, null), card("gato", 0, 0, null));
        assertThat(anki.statuses(me, "es")).containsOnlyKeys("perro").containsEntry("perro", "known");
    }

    @Test
    void theMostAdvancedCardDecides() throws Exception {
        anki.save(me, "perro", "learning");
        anki.sync(me, young("perro"), mature("Perro"), young("perro"));
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "known");
    }

    @Test
    void theMostAdvancedCardDecidesAcrossBatches() throws Exception {
        anki.save(me, "perro", "learning");
        long run = anki.start(me, false);
        anki.send(me, run, AnkiApi.DECK, java.util.List.of(mature("perro")), 200);
        anki.send(me, run, AnkiApi.DECK, java.util.List.of(young("perro")), 200);
        anki.finish(me, run, java.util.List.of(AnkiApi.DECK));
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "known");
    }

    @Test
    void wordsAreReadOutOfTheirFieldsAndNonWordsAreSkipped() throws Exception {
        JsonNode run = anki.sync(me, mature("<b>Perro</b>&nbsp;"), mature("tout à fait"), mature("[sound:g.mp3]gato"),
                mature(""), mature("uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece"),
                mature("<img src=\"a.jpg\">"));
        assertThat(anki.statuses(me, "es")).containsOnlyKeys("perro", "tout à fait", "gato");
        assertThat(anki.entry(me, "es", "tout à fait").get("kind").asString()).isEqualTo("phrase");
        assertThat(AnkiApi.counts(run)).containsAllEntriesOf(Map.of(
                "skippedEmpty", 1, "skippedTooLong", 1, "skippedMedia", 1, "addedKnown", 3));
    }

    @Test
    void theMeaningFillsAnEmptyDefinitionOnly() throws Exception {
        anki.save(me, "gato", "learning");
        api.patch(me, "/api/vocabulary/" + anki.entry(me, "es", "gato").get("id").asLong(),
                "{\"definition\":\"my cat\"}", 200);
        anki.save(me, "casa", "learning");
        anki.sync(me, card("perro", 2, 30, "<i>dog</i>"), card("gato", 2, 30, "cat"), card("casa", 2, 3, "house"));
        assertThat(anki.entry(me, "es", "perro").get("definition").asString()).isEqualTo("dog");
        assertThat(anki.entry(me, "es", "gato").get("definition").asString()).isEqualTo("my cat");
        assertThat(anki.entry(me, "es", "casa").get("definition").asString()).isEqualTo("house");
    }

    @Test
    void theFirstSyncCountsLikeAnImportAndLaterOnesAsLearnedToday() throws Exception {
        Instant before = Instant.now();
        anki.save(me, "gato", "learning");
        anki.sync(me, mature("perro"), mature("gato"));
        long id = myId();
        Instant joined = users.findById(id).orElseThrow().getCreatedAt();
        assertThat(vocabulary.findByUserIdAndLanguageAndTerm(id, Language.ES, "perro").orElseThrow().getKnownAt())
                .isEqualTo(joined);
        assertThat(vocabulary.findByUserIdAndLanguageAndTerm(id, Language.ES, "gato").orElseThrow().getKnownAt())
                .isEqualTo(joined);
        anki.save(me, "casa", "learning");
        anki.sync(me, mature("perro"), mature("gato"), mature("casa"), mature("mesa"));
        assertThat(vocabulary.findByUserIdAndLanguageAndTerm(id, Language.ES, "casa").orElseThrow().getKnownAt())
                .isAfterOrEqualTo(before);
        assertThat(vocabulary.findByUserIdAndLanguageAndTerm(id, Language.ES, "mesa").orElseThrow().getKnownAt())
                .isAfterOrEqualTo(before);
    }

    @Test
    void theFreePlansLimitStopsLearningWordsButNotKnownOnes() throws Exception {
        String free = api.signup();
        anki.chooseSpanish(free);
        java.util.List<Map<String, Object>> first = new java.util.ArrayList<>();
        for (int i = 0; i < 490; i++) {
            first.add(young("viejo" + i));
        }
        long warm = anki.start(free, false);
        anki.send(free, warm, AnkiApi.DECK, first, 200);
        anki.finish(free, warm, java.util.List.of(AnkiApi.DECK));
        java.util.List<Map<String, Object>> cards = new java.util.ArrayList<>(first);
        for (int i = 0; i < 30; i++) {
            cards.add(young("nuevo" + i));
        }
        for (int i = 0; i < 50; i++) {
            cards.add(mature("conocido" + i));
        }
        long run = anki.start(free, false);
        anki.send(free, run, AnkiApi.DECK, cards, 200);
        JsonNode done = anki.finish(free, run, java.util.List.of(AnkiApi.DECK));
        assertThat(AnkiApi.counts(done)).containsAllEntriesOf(Map.of(
                "addedLearning", 10, "overLimit", 20, "addedKnown", 50));
        assertThat(anki.words(free, run, "over_limit")).hasSize(20);
    }
}
