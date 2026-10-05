package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.text.TextBody;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: lists of cards (Library, Explore, playlists) stay fast however long the texts are. A card needs a text's
 * title, counts and distinct words, never its content, tokens or timings, so listing must not load any text body.
 */
@ApiTest
class CardListsTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    TestApi api;
    String me;
    long text;
    long playlist;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signupPro();
        text = api.createText(me, "fr", "Bonjour à tous. Le chat dort.", true);
        playlist = api.post(me, "/api/playlists", "{\"title\":\"P\",\"language\":\"fr\"}", 201).get("id").asLong();
        api.put(me, "/api/playlists/" + playlist + "/items/" + text, "", 204);
        api.post(me, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"chat\",\"status\":\"known\"}", 201);
    }

    private long bodiesLoadedBy(String path) throws Exception {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        api.get(me, path, 200);
        return stats.getEntityStatistics(TextBody.class.getName()).getLoadCount();
    }

    @Test
    void myLibraryLoadsNoTextBodies() throws Exception {
        assertThat(bodiesLoadedBy("/api/texts?language=fr")).isZero();
    }

    @Test
    void exploreLoadsNoTextBodies() throws Exception {
        assertThat(bodiesLoadedBy("/api/library?language=fr&sort=new&page=0&size=24")).isZero();
        assertThat(bodiesLoadedBy("/api/library?language=fr&sort=popular&page=0&size=24")).isZero();
        assertThat(bodiesLoadedBy("/api/library/shelves?language=fr")).isZero();
        api.post(me, "/api/texts/" + text + "/progress", "{\"position\":2}", 200); // fills Continue reading
        assertThat(bodiesLoadedBy("/api/recommendations?language=fr")).isZero();
        assertThat(bodiesLoadedBy("/api/library?language=fr&topic=cooking")).isZero();
    }

    @Test
    void aPlaylistLoadsNoTextBodies() throws Exception {
        assertThat(bodiesLoadedBy("/api/playlists/" + playlist)).isZero();
    }

    @Test
    void cardsStillCountKnownWordsFromTheText() throws Exception {
        JsonNode card = api.get(me, "/api/texts?language=fr", 200).get(0);
        assertThat(card.get("id").asLong()).isEqualTo(text);
        assertThat(card.get("stats").get("known").asInt()).isEqualTo(1);
        assertThat(card.get("stats").get("uniqueWords").asInt()).isEqualTo(card.get("uniqueWordCount").asInt());
    }

    @Test
    void openingATextStillGivesItsContentAndTokens() throws Exception {
        JsonNode detail = api.get(me, "/api/texts/" + text, 200);
        assertThat(detail.get("text").get("title").asString()).isNotBlank();
        assertThat(detail.get("tokens").size()).isGreaterThan(5);
        assertThat(detail.get("statuses").get("chat").asString()).isEqualTo("known");
    }
}
