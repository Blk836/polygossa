package app.lector.level;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import app.lector.TestApi;
import app.lector.ai.WritingGrader.Grade;
import app.lector.progress.ReadingProgress;
import app.lector.progress.ReadingProgressRepository;
import app.lector.session.ReadingSession;
import app.lector.session.ReadingSessionRepository;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.user.UserRepository;
import app.lector.vocab.EntryKind;
import app.lector.vocab.VocabularyEntry;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import app.lector.writing.PromptBank;
import app.lector.writing.WritingTest;
import app.lector.writing.WritingTestRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Feature: Reading, Listening and Writing levels on the Progress tab, from the learner's own evidence. */
@ApiTest
class SkillLevelApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired VocabularyRepository vocabulary;
    @Autowired TextRepository texts;
    @Autowired ReadingProgressRepository progress;
    @Autowired ReadingSessionRepository sessions;
    @Autowired WritingTestRepository writingTests;

    TestApi api;
    String token;
    User user;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        token = api.signupPro();
        user = userOf(token);
    }

    private User userOf(String t) throws Exception {
        return users.findById(api.get(t, "/api/me", 200).get("id").asLong()).orElseThrow();
    }

    private JsonNode levels(String language) throws Exception {
        return api.get(token, "/api/levels?language=" + language, 200);
    }

    private static String level(JsonNode skill) {
        JsonNode l = skill.path("level");
        return l.isMissingNode() || l.isNull() ? null : l.asString();
    }

    private void know(User u, Language language, int count) {
        List<VocabularyEntry> entries = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            VocabularyEntry e = new VocabularyEntry(u, language, "w" + i, "w" + i, EntryKind.WORD);
            e.changeStatus(WordStatus.KNOWN);
            entries.add(e);
        }
        vocabulary.saveAll(entries);
    }

    private Text text(User u, Language language, String cefr, String media) {
        Text t = new Text(u, "T", language, "hola");
        t.setCefrLevel(cefr);
        if ("video".equals(media)) {
            t.setVideo("dQw4w9WgXcQ", 120);
        } else if ("audio".equals(media)) {
            t.setAudioUrl("https://example.com/a.mp3");
        }
        return texts.save(t);
    }

    private Text read(User u, Language language, String cefr, String media, int percent, boolean completed) {
        Text t = text(u, language, cefr, media);
        ReadingProgress p = new ReadingProgress(u, t);
        p.setPercent(percent);
        p.setCompleted(completed);
        p.setUpdatedAt(Instant.now());
        progress.save(p);
        return t;
    }

    private void finish(Language language, String cefr, String media, int times) {
        for (int i = 0; i < times; i++) {
            read(user, language, cefr, media, 100, true);
        }
    }

    private void session(Text t, long seconds) {
        ReadingSession s = new ReadingSession(user, t, Instant.now());
        s.setDurationSeconds(seconds);
        sessions.save(s);
    }

    private WritingTest writingTest(User u, Language language, Instant startedAt) {
        return new WritingTest(u, language, "B1", new PromptBank.Prompt("B1-01", "A situation"), 60, startedAt,
                startedAt.plus(Duration.ofMinutes(5)));
    }

    private void graded(Language language, String level, Instant at) {
        WritingTest t = writingTest(user, language, at.minusSeconds(60));
        t.handIn("texto", 60, at);
        t.graded(json.writeValueAsString(new Grade(70, level, List.of(), List.of(), "texto", "ok")), "m", "v");
        writingTests.save(t);
    }

    // ---- Reading ----

    @Test
    void readingFromKnownWordsRaisedByFinishedTexts() throws Exception {
        know(user, Language.ES, 1300);
        finish(Language.ES, "B2", null, 3);
        JsonNode l = levels("es");
        assertThat(l.get("language").asString()).isEqualTo("es");
        assertThat(l.get("knownWords").asLong()).isEqualTo(1300);
        assertThat(level(l.get("reading"))).isEqualTo("B1");
        assertThat(l.get("reading").get("evidence").asInt()).isEqualTo(3);
        assertThat(l.get("reading").get("confidence").asString()).isEqualTo("medium");
    }

    @Test
    void textsOpenedButNotFinishedDoNotCount() throws Exception {
        know(user, Language.ES, 1300);
        for (int i = 0; i < 3; i++) {
            read(user, Language.ES, "B1", null, 80, false);
        }
        JsonNode l = levels("es");
        assertThat(level(l.get("reading"))).isEqualTo("A2");
        assertThat(l.get("reading").get("evidence").asInt()).isZero();
    }

    @Test
    void onlyTheRequestedLanguageCounts() throws Exception {
        know(user, Language.FR, 6000);
        know(user, Language.ES, 100);
        finish(Language.FR, "C1", "video", 3);
        JsonNode l = levels("es");
        assertThat(l.get("knownWords").asLong()).isEqualTo(100);
        assertThat(level(l.get("reading"))).isEqualTo("A1");
        assertThat(level(l.get("listening"))).isNull();
        JsonNode fr = levels("fr");
        assertThat(level(fr.get("reading"))).isEqualTo("B2");
        assertThat(level(fr.get("listening"))).isEqualTo("C1");
    }

    @Test
    void learningAndIgnoredWordsAreNotKnown() throws Exception {
        know(user, Language.ES, 60);
        vocabulary.save(new VocabularyEntry(user, Language.ES, "aprendo", "aprendo", EntryKind.WORD));
        assertThat(levels("es").get("knownWords").asLong()).isEqualTo(60);
    }

    // ---- Listening ----

    @Test
    void videosAndAudioCountForListeningNotReading() throws Exception {
        know(user, Language.ES, 3000);
        finish(Language.ES, "A2", "video", 3);
        finish(Language.ES, "B1", "audio", 3);
        JsonNode l = levels("es");
        assertThat(level(l.get("reading"))).isEqualTo("B1");
        assertThat(l.get("reading").get("evidence").asInt()).isZero();
        assertThat(level(l.get("listening"))).isEqualTo("B1");
        assertThat(l.get("listening").get("evidence").asInt()).isEqualTo(6);
    }

    @Test
    void listeningTimeCountsSessionsOnVideosAndAudioOnly() throws Exception {
        session(text(user, Language.ES, "A1", "video"), 60 * 60);
        session(text(user, Language.ES, "A1", "audio"), 35 * 60);
        session(text(user, Language.ES, "A1", null), 50 * 60);
        session(text(user, Language.FR, "A1", "video"), 20 * 60);
        assertThat(levels("es").get("listeningSeconds").asLong()).isEqualTo(95 * 60);
    }

    @Test
    void textsWithoutALevelAreIgnored() throws Exception {
        know(user, Language.ES, 1300);
        finish(Language.ES, null, null, 3);
        finish(Language.ES, null, "video", 3);
        JsonNode l = levels("es");
        assertThat(l.get("reading").get("evidence").asInt()).isZero();
        assertThat(level(l.get("listening"))).isNull();
    }

    // ---- Writing ----

    @Test
    void writingFromTheLastFiveGradedTestsNewestFirst() throws Exception {
        Instant t0 = Instant.parse("2026-09-01T10:00:00Z");
        for (int i = 0; i < 10; i++) {
            graded(Language.ES, "A1", t0.plus(Duration.ofHours(i)));
        }
        for (int i = 0; i < 5; i++) {
            graded(Language.ES, "B2", t0.plus(Duration.ofDays(2 + i)));
        }
        JsonNode w = levels("es").get("writing");
        assertThat(level(w)).isEqualTo("B2");
        assertThat(w.get("evidence").asInt()).isEqualTo(5);
        assertThat(w.get("confidence").asString()).isEqualTo("high");
    }

    @Test
    void ungradedExpiredAndUnknownLevelTestsAreIgnored() throws Exception {
        Instant t0 = Instant.parse("2026-09-01T10:00:00Z");
        graded(Language.ES, "B1", t0);
        graded(Language.ES, "B1", t0.plusSeconds(3600));
        graded(Language.ES, null, t0.plusSeconds(7200));
        graded(Language.FR, "C2", t0.plusSeconds(9000));
        for (int i = 0; i < 3; i++) {
            WritingTest ungraded = writingTest(user, Language.ES, t0);
            ungraded.handIn("texto", 60, t0.plusSeconds(100 + i));
            ungraded.gradingFailed("AI down");
            writingTests.save(ungraded);
        }
        writingTests.save(writingTest(user, Language.ES, t0)); // never handed in: expired
        JsonNode w = levels("es").get("writing");
        assertThat(level(w)).isEqualTo("B1");
        assertThat(w.get("evidence").asInt()).isEqualTo(2);
        assertThat(w.get("confidence").asString()).isEqualTo("low");
    }

    // ---- Overall, empty states, access ----

    @Test
    void overallIsTheAverageOfSkillsWithData() throws Exception {
        know(user, Language.ES, 5000); // B2
        finish(Language.ES, "B1", "video", 3); // B1
        graded(Language.ES, "A2", Instant.parse("2026-09-01T10:00:00Z"));
        JsonNode o = levels("es").get("overall");
        assertThat(o.get("level").asString()).isEqualTo("B1");
        assertThat(o.get("basedOn")).extracting(JsonNode::asString).containsExactly("reading", "listening", "writing");
    }

    @Test
    void aNewUserHasNoLevelsAndNoOverall() throws Exception {
        JsonNode l = levels("es");
        assertThat(level(l.get("reading"))).isNull();
        assertThat(level(l.get("listening"))).isNull();
        assertThat(level(l.get("writing"))).isNull();
        assertThat(l.path("overall").isMissingNode() || l.path("overall").isNull()).isTrue();
        assertThat(l.get("knownWords").asLong()).isZero();
        assertThat(l.get("listeningSeconds").asLong()).isZero();
    }

    @Test
    void otherUsersEvidenceIsNotCounted() throws Exception {
        String other = api.signupPro();
        know(userOf(other), Language.ES, 2000);
        assertThat(levels("es").get("knownWords").asLong()).isZero();
    }

    @Test
    void theFreePlanSeesItsLevels() throws Exception {
        token = api.signup();
        user = userOf(token);
        know(user, Language.ES, 1200);
        graded(Language.ES, "A2", Instant.parse("2026-09-01T10:00:00Z"));
        JsonNode l = levels("es");
        assertThat(level(l.get("reading"))).isEqualTo("A2");
        assertThat(level(l.get("writing"))).isEqualTo("A2");
    }

    @Test
    void withoutALanguageTheTargetLanguageIsUsed() throws Exception {
        api.patch(token, "/api/me", "{\"targetLanguage\":\"de\"}", 200);
        know(user, Language.DE, 70);
        JsonNode l = api.get(token, "/api/levels", 200);
        assertThat(l.get("language").asString()).isEqualTo("de");
        assertThat(l.get("knownWords").asLong()).isEqualTo(70);
    }

    @Test
    void withoutALanguageOrTargetLanguageItIsABadRequest() throws Exception {
        api.get(token, "/api/levels", 400);
    }

    @Test
    void signedOutIsRefused() throws Exception {
        api.get(null, "/api/levels?language=es", 401);
    }
}
