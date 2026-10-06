package app.lector.wordimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.TestApi;
import app.lector.YouTubeApiTest;
import app.lector.token.Language;
import app.lector.user.UserRepository;
import app.lector.vocab.VocabularyRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Feature: Import my words from LingQ and Readlang (docs/acceptance/word-import.feature). */
@YouTubeApiTest
class WordImportApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    VocabularyRepository vocabulary;

    @Autowired
    UserRepository users;

    @Autowired
    WordImportService imports;

    @Autowired
    WordImportRepository jobs;

    @Autowired
    JdbcTemplate jdbc;

    TestApi api;
    String me;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signupPro();
    }

    private static String newKey() {
        return "k" + UUID.randomUUID().toString().replace("-", "");
    }

    private JsonNode startLingq(String user, String key, String language, int status) throws Exception {
        String lang = language == null ? "" : ",\"language\":\"" + language + "\"";
        return api.post(user, "/api/word-imports/lingq", "{\"apiKey\":\"" + key + "\"" + lang + "}", status);
    }

    private JsonNode startReadlang(String user, String content, String language, int status) throws Exception {
        var req = multipart("/api/word-imports/readlang")
                .file(new MockMultipartFile("file", "words.csv", "text/csv", content.getBytes(StandardCharsets.UTF_8)));
        if (language != null) {
            req.param("language", language);
        }
        return api.send(req, user, status);
    }

    /** Polls the import until it has finished, as the Vocabulary page does. */
    private JsonNode await(String user, JsonNode started) throws Exception {
        long deadline = System.currentTimeMillis() + 15_000;
        while (true) {
            JsonNode job = api.get(user, "/api/word-imports/" + started.get("id").asLong(), 200);
            String state = job.get("state").asString();
            if (state.equals("done") || state.equals("failed") || System.currentTimeMillis() > deadline) {
                return job;
            }
            Thread.sleep(50);
        }
    }

    /** term → status of my words in a language (sorted by term: many words share an update time, so "recent" pages can overlap). */
    private Map<String, String> words(String user, String language) throws Exception {
        Map<String, String> out = new HashMap<>();
        for (int page = 0; page * 200 < out.size() + 200; page++) {
            JsonNode result = api.get(user, "/api/vocabulary?language=" + language + "&size=200&sort=alpha&page=" + page, 200);
            result.get("items").forEach(w -> out.put(w.get("term").asString(), w.get("status").asString()));
            if (out.size() >= result.get("total").asLong()) {
                return out;
            }
        }
        return out;
    }

    private JsonNode word(String user, String language, String term) throws Exception {
        for (JsonNode w : api.get(user, "/api/vocabulary?language=" + language + "&q=" + term.split(" ")[0], 200).get("items")) {
            if (w.get("term").asString().equals(term)) {
                return w;
            }
        }
        return null;
    }

    private static void counts(JsonNode job, int found, int added, int updated, int unchanged, int overLimit) {
        assertThat(List.of(job.get("found").asInt(), job.get("added").asInt(), job.get("updated").asInt(),
                job.get("unchanged").asInt(), job.get("overLimit").asInt()))
                .containsExactly(found, added, updated, unchanged, overLimit);
    }

    // ---- LingQ ----

    @Test
    void aLingqImportBringsLingqsAndKnownWordsInTheBackground() throws Exception {
        String key = newKey();
        LingqStub.Account account = YouTubeApiTest.LINGQ.account(key);
        for (int i = 0; i < 250; i++) {
            account.card("fr", "mot" + i, 1, 0, null, null);
        }
        account.card("fr", "maison", 2, 0, "house", "Une maison bleue").card("fr", "tout à fait", 4, 0, null, null)
                .knownWord("fr", "Chat").knownWord("fr", "chien");

        JsonNode started = startLingq(me, key, "fr", 202);
        assertThat(started.get("source").asString()).isEqualTo("lingq");
        assertThat(started.get("language").asString()).isEqualTo("fr");
        assertThat(started.get("state").asString()).isIn("queued", "running", "done");
        assertThat(started.toString()).doesNotContain(key);
        assertThat(started.get("createdAt").isNull()).isFalse();

        JsonNode done = await(me, started);
        assertThat(done.get("state").asString()).isEqualTo("done");
        counts(done, 254, 254, 0, 0, 0);
        assertThat(done.get("finishedAt").isNull()).isFalse();
        Map<String, String> mine = words(me, "fr");
        assertThat(mine).hasSize(254).containsEntry("mot0", "learning").containsEntry("maison", "learning")
                .containsEntry("tout à fait", "known").containsEntry("chat", "known").containsEntry("chien", "known");
        JsonNode maison = word(me, "fr", "maison");
        assertThat(maison.get("definition").asString()).isEqualTo("house");
        assertThat(maison.get("contextSentence").asString()).isEqualTo("Une maison bleue");
        assertThat(word(me, "fr", "tout à fait").get("kind").asString()).isEqualTo("phrase");
        assertThat(YouTubeApiTest.LINGQ.authorizations()).allMatch(a -> a.startsWith("Token "));
    }

    @Test
    void withoutALanguageEveryLanguageIsImported() throws Exception {
        String key = newKey();
        YouTubeApiTest.LINGQ.account(key).card("es", "casa", 0, 0, null, null).knownWord("ja", "猫")
                .card("ko", "집", 0, 0, null, null);
        JsonNode done = await(me, startLingq(me, key, null, 202));
        assertThat(done.get("state").asString()).isEqualTo("done");
        assertThat(done.get("language").isNull()).isTrue();
        counts(done, 3, 3, 0, 0, 0);
        assertThat(words(me, "es")).containsOnlyKeys("casa");
        assertThat(words(me, "ja")).containsEntry("猫", "known");
        assertThat(words(me, "ko")).containsOnlyKeys("집");
        List<String> asked = YouTubeApiTest.LINGQ.account(key).requests().stream().map(r -> r.substring(8, 10)).distinct()
                .toList();
        assertThat(asked).containsExactlyInAnyOrder("es", "fr", "de", "it", "pt", "ja", "zh", "ko");
    }

    @Test
    void aRejectedKeyFailsTheImportAndSavesNothing() throws Exception {
        JsonNode done = await(me, startLingq(me, "notakey", "fr", 202));
        assertThat(done.get("state").asString()).isEqualTo("failed");
        assertThat(done.get("error").asString())
                .isEqualTo("LingQ didn't accept this API key. Copy it again from lingq.com/accounts/apikey.");
        assertThat(words(me, "fr")).isEmpty();
    }

    @Test
    void lingqFailingPartwayKeepsWhatWasImported() throws Exception {
        String key = newKey();
        LingqStub.Account account = YouTubeApiTest.LINGQ.account(key);
        for (int i = 0; i < 450; i++) {
            account.card("fr", "mot" + i, 0, 0, null, null);
        }
        account.fail("cards", 3, 500);
        JsonNode done = await(me, startLingq(me, key, "fr", 202));
        assertThat(done.get("state").asString()).isEqualTo("failed");
        assertThat(done.get("error").asString()).isEqualTo("LingQ couldn't be reached. Try again later.");
        counts(done, 400, 400, 0, 0, 0);
        assertThat(words(me, "fr")).hasSize(400);
    }

    @Test
    void invalidLingqStartsAreRejected() throws Exception {
        startLingq(me, "", "fr", 400);
        startLingq(me, "has space", "fr", 400);
        startLingq(me, "semi;colon", "fr", 400);
        startLingq(me, "x".repeat(101), "fr", 400);
        startLingq(me, newKey(), "xx", 400);
        api.post(me, "/api/word-imports/lingq", "{}", 400);
        assertThat(api.get(me, "/api/word-imports", 200)).isEmpty();
    }

    // ---- Readlang ----

    @Test
    void aReadlangImportReadsTheExportedFile() throws Exception {
        JsonNode started = startReadlang(me, "Word,Translation,Context\nmaison,house,Une maison bleue\nchat,cat,\n",
                "fr", 202);
        assertThat(started.get("source").asString()).isEqualTo("readlang");
        JsonNode done = await(me, started);
        assertThat(done.get("state").asString()).isEqualTo("done");
        counts(done, 2, 2, 0, 0, 0);
        assertThat(words(me, "fr")).containsEntry("maison", "learning").containsEntry("chat", "learning");
        assertThat(word(me, "fr", "maison").get("definition").asString()).isEqualTo("house");
    }

    @Test
    void termsOverFiveHundredCharactersAreLeftOut() throws Exception {
        String longest = "a".repeat(500);
        JsonNode done = await(me, startReadlang(me, longest + ",x\n" + "b".repeat(501) + ",y\n", "fr", 202));
        counts(done, 2, 1, 0, 0, 0);
        assertThat(words(me, "fr")).containsOnlyKeys(longest);
    }

    @Test
    void invalidReadlangStartsAreRejected() throws Exception {
        startReadlang(me, "maison,house\n", null, 400);
        startReadlang(me, "maison,house\n", "xx", 400);
        startReadlang(me, "", "fr", 400);
        startReadlang(me, "word,translation\n", "fr", 400);
        startReadlang(me, "a,b\n".repeat(5 * 1024 * 1024 / 4 + 1), "fr", 400);
        api.send(multipart("/api/word-imports/readlang").param("language", "fr"), me, 400);
        assertThat(api.get(me, "/api/word-imports", 200)).isEmpty();
    }

    // ---- Merging ----

    @Test
    void anImportNeverLowersWhatIKnowButCanRaiseIt() throws Exception {
        api.post(me, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"maison\",\"status\":\"known\"}", 201);
        api.post(me, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"chat\",\"status\":\"ignored\"}", 201);
        api.post(me, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"chien\",\"status\":\"learning\","
                + "\"definition\":\"my dog\"}", 201);
        String key = newKey();
        YouTubeApiTest.LINGQ.account(key).card("fr", "maison", 0, 0, "house", "Une maison").card("fr", "chat", 1, 0, null, null)
                .card("fr", "chien", 4, 0, "dog", "Le chien").card("fr", "Oiseau", 0, 0, null, null)
                .knownWord("fr", "oiseau");
        JsonNode done = await(me, startLingq(me, key, "fr", 202));
        // maison gains a context sentence (updated), chat is unchanged, chien becomes known (updated), oiseau is
        // added as learning and then raised to known by the known-words list (updated).
        counts(done, 5, 1, 3, 1, 0);
        assertThat(words(me, "fr")).containsExactlyInAnyOrderEntriesOf(
                Map.of("maison", "known", "chat", "ignored", "chien", "known", "oiseau", "known"));
        JsonNode maison = word(me, "fr", "maison");
        assertThat(maison.get("definition").asString()).isEqualTo("house");
        JsonNode chien = word(me, "fr", "chien");
        assertThat(chien.get("definition").asString()).isEqualTo("my dog");
        assertThat(chien.get("contextSentence").asString()).isEqualTo("Le chien");

        JsonNode again = await(me, startLingq(me, key, "fr", 202));
        counts(again, 5, 0, 0, 5, 0);
    }

    @Test
    void theSameWordTwiceInOneBatchBecomesOneEntry() throws Exception {
        JsonNode done = await(me, startReadlang(me, "Maison,house\nmaison,home\n", "fr", 202));
        counts(done, 2, 1, 0, 1, 0);
        assertThat(words(me, "fr")).containsOnlyKeys("maison");
        assertThat(word(me, "fr", "maison").get("displayTerm").asString()).isEqualTo("Maison");
    }

    @Test
    void importedKnownWordsCountAsKnownBeforeIJoined() throws Exception {
        Instant before = Instant.now();
        String key = newKey();
        YouTubeApiTest.LINGQ.account(key).knownWord("de", "Haus").card("de", "Hund", 0, 0, null, null);
        await(me, startLingq(me, key, "de", 202));
        Long userId = userIdOf(me);
        Instant joined = users.findById(userId).orElseThrow().getCreatedAt();
        var haus = vocabulary.findByUserIdAndLanguageAndTerm(userId, Language.DE, "haus").orElseThrow();
        assertThat(haus.getKnownAt()).isEqualTo(joined).isBefore(before);
        assertThat(vocabulary.knownSinceByUser(before).stream().filter(c -> c.getUserId().equals(userId))).isEmpty();
    }

    // ---- Plan limits ----

    @Test
    void theFreePlanLimitStopsLearningWordsButNotKnownOnes() throws Exception {
        String free = api.signup();
        StringBuilder csv = new StringBuilder();
        for (int i = 0; i < 490; i++) {
            csv.append("deja").append(i).append(",x\n");
        }
        assertThat(await(free, startReadlang(free, csv.toString(), "fr", 202)).get("added").asInt()).isEqualTo(490);
        String key = newKey();
        LingqStub.Account account = YouTubeApiTest.LINGQ.account(key);
        for (int i = 0; i < 30; i++) {
            account.card("fr", "neuf" + i, 0, 0, null, null);
        }
        for (int i = 0; i < 50; i++) {
            account.knownWord("fr", "connu" + i);
        }
        JsonNode done = await(free, startLingq(free, key, "fr", 202));
        assertThat(done.get("state").asString()).isEqualTo("done");
        counts(done, 80, 60, 0, 0, 20);
        Map<String, String> mine = words(free, "fr");
        assertThat(mine.values().stream().filter("learning"::equals)).hasSize(500);
        assertThat(mine.values().stream().filter("known"::equals)).hasSize(50);
    }

    // ---- Jobs ----

    @Test
    void oneImportAtATime() throws Exception {
        String key = newKey();
        LingqStub.Account account = YouTubeApiTest.LINGQ.account(key).rateLimit(1);
        account.card("fr", "maison", 0, 0, null, null);
        WordImport running = jobs.save(new WordImport(userIdOf(me), WordImport.Source.LINGQ, Language.FR, Instant.now()));
        api.post(me, "/api/word-imports/lingq", "{\"apiKey\":\"" + key + "\"}", 409);
        startReadlang(me, "maison\n", "fr", 409);
        running.fail("test over", Instant.now());
        jobs.save(running);
        await(me, startLingq(me, key, "fr", 202));
    }

    @Test
    void recentImportsAreListedNewestFirstAndArePrivate() throws Exception {
        for (int i = 0; i < 6; i++) {
            await(me, startReadlang(me, "mot" + i + "\n", "fr", 202));
        }
        JsonNode list = api.get(me, "/api/word-imports", 200);
        assertThat(list).hasSize(5);
        assertThat(list.get(0).get("id").asLong()).isGreaterThan(list.get(1).get("id").asLong());
        long mine = list.get(0).get("id").asLong();
        String other = api.signup();
        api.get(other, "/api/word-imports/" + mine, 404);
        assertThat(api.get(other, "/api/word-imports", 200)).isEmpty();
        api.get(me, "/api/word-imports/999999999", 404);
    }

    @Test
    void importsCutOffByARestartAreMarkedInterrupted() throws Exception {
        Long user = userIdOf(me);
        WordImport queued = jobs.save(new WordImport(user, WordImport.Source.LINGQ, Language.FR, Instant.now()));
        WordImport running = new WordImport(user, WordImport.Source.READLANG, Language.FR, Instant.now());
        running.start();
        running = jobs.save(running);
        imports.markInterrupted();
        for (WordImport job : List.of(queued, running)) {
            JsonNode shown = api.get(me, "/api/word-imports/" + job.getId(), 200);
            assertThat(shown.get("state").asString()).isEqualTo("failed");
            assertThat(shown.get("error").asString()).isEqualTo("Interrupted: please start it again");
        }
    }

    @Test
    void theApiKeyIsNeverStored() throws Exception {
        String key = newKey();
        YouTubeApiTest.LINGQ.account(key).card("fr", "maison", 0, 0, null, null);
        JsonNode done = await(me, startLingq(me, key, "fr", 202));
        for (Map<String, Object> row : jdbc.queryForList("select * from word_imports where id = ?",
                done.get("id").asLong())) {
            assertThat(row.values()).noneMatch(v -> String.valueOf(v).contains(key));
        }
        assertThat(api.get(me, "/api/word-imports", 200).toString()).doesNotContain(key);
    }

    private Long userIdOf(String token) throws Exception {
        return api.get(token, "/api/me", 200).get("id").asLong();
    }
}
