package app.lector.anki;

import static app.lector.anki.AnkiApi.DECK;
import static app.lector.anki.AnkiApi.mature;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ClockApiTest;
import app.lector.TestApi;
import app.lector.TestClock;
import app.lector.token.Language;
import app.lector.vocab.VocabularyRepository;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ClockApiTest
class AnkiStoppedRunApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    VocabularyRepository vocabulary;

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
    void aSyncThatStopsKeepsWhatItSentAndTheNextOneCanStart() throws Exception {
        long run = anki.start(me, false);
        anki.send(me, run, DECK, List.of(mature("perro")), 200);
        TestClock.CLOCK.advance(Duration.ofSeconds(119));
        api.post(me, "/api/anki/runs", "{\"dryRun\":false}", 409);
        TestClock.CLOCK.advance(Duration.ofSeconds(2));
        JsonNode latest = api.get(me, "/api/anki/runs/latest", 200);
        assertThat(latest.get("id").asLong()).isEqualTo(run);
        assertThat(latest.get("state").asString()).isEqualTo("stopped");
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "known");
        anki.send(me, run, DECK, List.of(mature("gato")), 409);
        anki.sync(me, mature("gato"));
    }

    @Test
    void aBatchKeepsTheSyncAlive() throws Exception {
        long run = anki.start(me, false);
        TestClock.CLOCK.advance(Duration.ofSeconds(100));
        anki.send(me, run, DECK, List.of(mature("perro")), 200);
        TestClock.CLOCK.advance(Duration.ofSeconds(100));
        anki.send(me, run, DECK, List.of(mature("gato")), 200);
        assertThat(anki.finish(me, run, List.of(DECK)).get("state").asString()).isEqualTo("done");
    }

    @Test
    void laterSyncsDateKnownWordsByTheClock() throws Exception {
        anki.sync(me, mature("perro"));
        TestClock.CLOCK.advance(Duration.ofDays(3));
        anki.save(me, "gato", "learning");
        anki.sync(me, mature("gato"));
        long id = api.get(me, "/api/me", 200).get("id").asLong();
        assertThat(vocabulary.findByUserIdAndLanguageAndTerm(id, Language.ES, "gato").orElseThrow().getKnownAt())
                .isEqualTo(TestClock.START.plus(Duration.ofDays(3)));
    }
}
