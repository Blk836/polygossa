package app.lector.anki;

import static app.lector.anki.AnkiApi.DECK;
import static app.lector.anki.AnkiApi.deck;
import static app.lector.anki.AnkiApi.young;
import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class AnkiReviewApiTest {

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
        anki.save(me, "perro", "learning");
        anki.save(me, "gato", "learning");
    }

    private List<String> queue() throws Exception {
        List<String> fronts = new ArrayList<>();
        api.get(me, "/api/review/queue?language=es", 200).forEach(c -> fronts.add(c.get("front").asString()));
        return fronts;
    }

    private long due() throws Exception {
        return api.get(me, "/api/review/stats?language=es", 200).get("dueWords").asLong();
    }

    private long inAnki() throws Exception {
        return api.get(me, "/api/review/stats?language=es", 200).get("wordsInAnki").asLong();
    }

    @Test
    void wordsReviewedInAnkiLeaveTheReviewTab() throws Exception {
        assertThat(queue()).containsExactlyInAnyOrder("perro", "gato");
        anki.sync(me, young("perro"));
        assertThat(queue()).containsExactly("gato");
        assertThat(due()).isEqualTo(1);
        assertThat(inAnki()).isEqualTo(1);
    }

    @Test
    void aCardDeletedInAnkiSendsItsWordBack() throws Exception {
        anki.sync(me, young("perro"), young("gato"));
        assertThat(queue()).isEmpty();
        anki.sync(me, young("gato"));
        assertThat(queue()).containsExactly("perro");
    }

    @Test
    void aDeckNotFinishedKeepsItsLinks() throws Exception {
        anki.sync(me, young("perro"));
        long run = anki.start(me, false);
        anki.send(me, run, DECK, List.of(young("gato")), 200);
        anki.finish(me, run, List.of());
        assertThat(queue()).isEmpty();
    }

    @Test
    void untickingADeckSendsItsWordsBackWithTheirSchedule() throws Exception {
        String dueBefore = anki.entry(me, "es", "perro").get("dueAt").asString();
        anki.chooseDecks(me, List.of(deck(DECK, "es"), deck(8, "es")), 200);
        anki.sync(me, young("perro"));
        long other = anki.start(me, false);
        anki.send(me, other, 8, List.of(young("gato")), 200);
        anki.finish(me, other, List.of(8L));
        assertThat(queue()).isEmpty();
        anki.chooseDecks(me, List.of(deck(8, "es")), 200);
        assertThat(queue()).containsExactly("perro");
        assertThat(anki.entry(me, "es", "perro").get("dueAt").asString()).isEqualTo(dueBefore);
        assertThat(anki.statuses(me, "es")).containsEntry("perro", "learning");
    }

    @Test
    void disconnectingSendsEveryWordBack() throws Exception {
        anki.sync(me, young("perro"), young("gato"));
        api.delete(me, "/api/anki/decks", 204);
        assertThat(queue()).containsExactlyInAnyOrder("perro", "gato");
        assertThat(inAnki()).isZero();
        assertThat(api.get(me, "/api/anki/decks", 200).get("decks")).isEmpty();
    }

    @Test
    void aWordInTwoDecksStaysInAnkiWhileEitherHasIt() throws Exception {
        anki.chooseDecks(me, List.of(deck(DECK, "es"), deck(8, "es")), 200);
        anki.sync(me, young("perro"));
        long other = anki.start(me, false);
        anki.send(me, other, 8, List.of(young("perro")), 200);
        anki.finish(me, other, List.of(8L));
        anki.chooseDecks(me, List.of(deck(8, "es")), 200);
        assertThat(queue()).containsExactly("gato");
        assertThat(inAnki()).isEqualTo(1);
    }

    @Test
    void theReaderCanAskWhetherAWordIsLinkedToAnki() throws Exception {
        anki.sync(me, AnkiApi.mature("perro"), young("gato"));
        var perro = api.get(me, "/api/anki/word?language=es&term=Perro", 200);
        assertThat(perro.get("state").asString()).isEqualTo("mature");
        assertThat(perro.get("promoted").asBoolean()).isTrue();
        var gato = api.get(me, "/api/anki/word?language=es&term=gato", 200);
        assertThat(gato.get("state").asString()).isEqualTo("young");
        assertThat(gato.get("promoted").asBoolean()).isFalse();
        api.get(me, "/api/anki/word?language=es&term=casa", 204);
        api.get(me, "/api/anki/word?language=fr&term=perro", 204);
        api.get(api.signupPro(), "/api/anki/word?language=es&term=perro", 204);
    }

    @Test
    void theWordShowsItsAnkiLink() throws Exception {
        anki.sync(me, AnkiApi.mature("perro"));
        var perro = anki.entry(me, "es", "perro");
        assertThat(perro.get("anki").get("state").asString()).isEqualTo("mature");
        assertThat(perro.get("anki").get("promoted").asBoolean()).isTrue();
        assertThat(anki.entry(me, "es", "gato").has("anki")).isFalse();
    }
}
