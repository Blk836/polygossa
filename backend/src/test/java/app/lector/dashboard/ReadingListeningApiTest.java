package app.lector.dashboard;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ClockApiTest;
import app.lector.TestApi;
import app.lector.TestClock;
import app.lector.writing.MutableClock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** reading-listening-goals.feature: words read, time listened and the daily goal. */
@ClockApiTest
class ReadingListeningApiTest {

    static final MutableClock CLOCK = TestClock.CLOCK;
    /** 600 words: word n is token 2n, so a page starting at token 240 has 120 words before it. */
    static final String CONTENT = "hola ".repeat(599) + "hola.";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private TestApi api;
    private String token;
    private long text;

    @BeforeEach
    void setUp() throws Exception {
        CLOCK.set(Instant.parse("2026-10-01T12:00:00Z"));
        api = new TestApi(mvc, json);
        token = api.signupPro();
        text = api.createText(token, "es", CONTENT, false);
    }

    private void at(long id, int position) throws Exception {
        api.post(token, "/api/texts/" + id + "/progress", "{\"position\":" + position + "}", 200);
    }

    private JsonNode today() throws Exception {
        return api.get(token, "/api/dashboard", 200).get("activity").get("days").valueStream().toList().getLast();
    }

    private long wordsToday() throws Exception {
        return today().get("wordsRead").asLong();
    }

    // --- Words read ---

    @Test
    void turningAPageCountsItsWords() throws Exception {
        at(text, 0);
        at(text, 240);
        assertThat(wordsToday()).isEqualTo(120);
        assertThat(api.get(token, "/api/dashboard", 200).get("period").get("current").get("wordsRead").asLong())
                .isEqualTo(120);
    }

    @Test
    void goingBackAddsNothingAndReReadingCountsAgain() throws Exception {
        at(text, 0);
        at(text, 240);
        at(text, 0);
        assertThat(wordsToday()).isEqualTo(120);
        at(text, 240);
        assertThat(wordsToday()).isEqualTo(240);
    }

    @Test
    void skippingAheadIsCapped() throws Exception {
        at(text, 0);
        at(text, 1100); // 550 words
        assertThat(wordsToday()).isEqualTo(500);
    }

    @Test
    void finishingALessonCountsTheRest() throws Exception {
        at(text, 0);
        at(text, 800); // 400 words
        api.post(token, "/api/texts/" + text + "/complete", "", 200);
        assertThat(wordsToday()).isEqualTo(600);
    }

    @Test
    void wordsReadArePerDayInMyTimeZoneAndPerLanguage() throws Exception {
        api.patch(token, "/api/me", "{\"timezone\":\"America/New_York\"}", 200);
        CLOCK.set(Instant.parse("2026-10-02T03:30:00Z")); // 23:30 on 1 Oct in New York
        long french = api.createText(token, "fr", "mot ".repeat(299) + "mot.", false);
        at(text, 0);
        at(text, 240);
        CLOCK.advance(Duration.ofMinutes(40)); // 00:10 on 2 Oct
        at(french, 0);
        at(french, 100);
        JsonNode dash = api.get(token, "/api/dashboard", 200);
        var days = dash.get("activity").get("days").valueStream().toList();
        assertThat(days.getLast().get("day").asString()).isEqualTo("2026-10-02");
        assertThat(days.getLast().get("wordsRead").asLong()).isEqualTo(50);
        assertThat(days.get(days.size() - 2).get("wordsRead").asLong()).isEqualTo(120);
        assertThat(dash.get("languages").valueStream()
                .map(l -> l.get("language").asString() + "=" + l.get("wordsRead").asLong()))
                .contains("es=120", "fr=50");
        assertThat(dash.get("totalWordsRead").asLong()).isEqualTo(170);
    }

    // --- Time listened ---

    private long session() throws Exception {
        return api.post(token, "/api/sessions", "{\"textId\":" + text + "}", 201).get("id").asLong();
    }

    private void beat(long session, String body) throws Exception {
        api.post(token, "/api/sessions/" + session + "/heartbeat", body, 200);
    }

    @Test
    void playingCountsAsListeningAndIsCapped() throws Exception {
        long s = session();
        CLOCK.advance(Duration.ofSeconds(40));
        beat(s, "{\"seconds\":40,\"listenedSeconds\":40}");
        assertThat(today().get("listenedSeconds").asLong()).isEqualTo(40);
        CLOCK.advance(Duration.ofSeconds(10));
        beat(s, "{\"seconds\":10,\"listenedSeconds\":100}"); // 10 s passed (+5 s grace)
        assertThat(today().get("listenedSeconds").asLong()).isEqualTo(55);
        CLOCK.advance(Duration.ofMinutes(20));
        beat(s, "{\"seconds\":0,\"listenedSeconds\":1200}"); // at most 5 minutes
        assertThat(today().get("listenedSeconds").asLong()).isEqualTo(355);
        CLOCK.advance(Duration.ofSeconds(30));
        beat(s, "{\"seconds\":0,\"listenedSeconds\":-30}");
        assertThat(today().get("listenedSeconds").asLong()).isEqualTo(355);
    }

    @Test
    void listeningWhileIdleAndOlderClients() throws Exception {
        long s = session();
        CLOCK.advance(Duration.ofSeconds(30));
        beat(s, "{\"seconds\":0,\"listenedSeconds\":30}");
        assertThat(today().get("readingSeconds").asLong()).isZero();
        assertThat(today().get("listenedSeconds").asLong()).isEqualTo(30);
        CLOCK.advance(Duration.ofSeconds(20));
        beat(s, "{\"seconds\":20}");
        assertThat(today().get("readingSeconds").asLong()).isEqualTo(20);
        assertThat(today().get("listenedSeconds").asLong()).isEqualTo(30);
        assertThat(api.get(token, "/api/dashboard", 200).get("totalListenedSeconds").asLong()).isEqualTo(30);
    }

    @Test
    void listeningOrReadingWordsCountsAsPractice() throws Exception {
        long s = session();
        CLOCK.advance(Duration.ofSeconds(60));
        beat(s, "{\"seconds\":0,\"listenedSeconds\":60}");
        assertThat(today().get("active").asBoolean()).isTrue();

        token = api.signup();
        text = api.createText(token, "es", CONTENT, false);
        at(text, 0);
        at(text, 20);
        assertThat(today().get("active").asBoolean()).isTrue();
    }

    // --- The daily goal ---

    private JsonNode goal() throws Exception {
        return api.get(token, "/api/me", 200).get("dailyGoal");
    }

    private JsonNode setGoal(String kind, int target, int status) throws Exception {
        return api.patch(token, "/api/me",
                "{\"dailyGoal\":{\"kind\":\"" + kind + "\",\"target\":" + target + "}}", status);
    }

    @Test
    void reviewsByDefault() throws Exception {
        assertThat(goal().get("kind").asString()).isEqualTo("reviews");
        assertThat(goal().get("target").asInt()).isEqualTo(20);
    }

    @Test
    void choosingWhatTheGoalMeasures() throws Exception {
        for (String[] g : new String[][] {{"words_read", "1000"}, {"minutes_read", "20"}, {"minutes_listened", "30"},
                {"reviews", "40"}}) {
            setGoal(g[0], Integer.parseInt(g[1]), 200);
            assertThat(goal().get("kind").asString()).isEqualTo(g[0]);
            assertThat(goal().get("target").asInt()).isEqualTo(Integer.parseInt(g[1]));
        }
        assertThat(api.get(token, "/api/me", 200).get("dailyReviewGoal").asInt()).isEqualTo(40);
    }

    @Test
    void invalidGoalsAreRefused() throws Exception {
        setGoal("words_read", 1000, 200);
        setGoal("words_read", 10, 400);
        setGoal("words_read", 50001, 400);
        setGoal("minutes_listened", 0, 400);
        setGoal("minutes_read", 601, 400);
        setGoal("pages", 10, 400);
        assertThat(goal().get("kind").asString()).isEqualTo("words_read");
        assertThat(goal().get("target").asInt()).isEqualTo(1000);
    }

    @Test
    void todaysGoalInTheHeader() throws Exception {
        setGoal("words_read", 1000, 200);
        at(text, 0);
        at(text, 240);
        JsonNode g = api.get(token, "/api/dashboard/header", 200).get("goal");
        assertThat(g.get("kind").asString()).isEqualTo("words_read");
        assertThat(g.get("target").asInt()).isEqualTo(1000);
        assertThat(g.get("done").asLong()).isEqualTo(120);
        assertThat(g.get("met").asBoolean()).isFalse();
        setGoal("words_read", 100, 200);
        assertThat(api.get(token, "/api/dashboard/header", 200).get("goal").get("met").asBoolean()).isTrue();
    }

    @Test
    void anOptInStreakOnlyCountsDaysThatReachTheGoal() throws Exception {
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);
        assertThat(api.get(token, "/api/dashboard/header", 200).get("activeToday").asBoolean()).isTrue();

        setGoal("words_read", 100, 200);
        JsonNode me = api.patch(token, "/api/me", "{\"streakNeedsGoal\":true}", 200);
        assertThat(me.get("streakNeedsGoal").asBoolean()).isTrue();
        assertThat(api.get(token, "/api/dashboard/header", 200).get("activeToday").asBoolean()).isFalse();
        at(text, 0);
        at(text, 240);
        assertThat(api.get(token, "/api/dashboard/header", 200).get("activeToday").asBoolean()).isTrue();
    }
}
