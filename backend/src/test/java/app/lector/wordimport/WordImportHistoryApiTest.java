package app.lector.wordimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.TestApi;
import app.lector.YouTubeApiTest;
import app.lector.token.Language;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Feature: Import my words from LingQ and Readlang (docs/acceptance/word-import.feature), import history: a successful
 * import replaces earlier rows for the same source and language; a failure replaces only an earlier failure.
 */
@YouTubeApiTest
class WordImportHistoryApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    WordImportService imports;

    @Autowired
    WordImportRepository jobs;

    TestApi api;
    String me;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signupPro();
    }

    /** A LingQ key whose account has one French, German and Spanish word, so every import succeeds. */
    private static String goodKey() {
        String key = "k" + UUID.randomUUID().toString().replace("-", "");
        YouTubeApiTest.LINGQ.account(key).card("fr", "maison", 0, 0, null, null).card("de", "Haus", 0, 0, null, null);
        return key;
    }

    private JsonNode lingq(String user, String key, String language) throws Exception {
        String lang = language == null ? "" : ",\"language\":\"" + language + "\"";
        return api.post(user, "/api/word-imports/lingq", "{\"apiKey\":\"" + key + "\"" + lang + "}", 202);
    }

    private JsonNode readlang(String user, String language) throws Exception {
        var req = multipart("/api/word-imports/readlang")
                .file(new MockMultipartFile("file", "words.csv", "text/csv", "maison,house\n".getBytes(StandardCharsets.UTF_8)))
                .param("language", language);
        return api.send(req, user, 202);
    }

    /** Polls the import until it has finished, then returns its id. */
    private long await(String user, JsonNode started) throws Exception {
        long id = started.get("id").asLong();
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            String state = api.get(user, "/api/word-imports/" + id, 200).get("state").asString();
            if (state.equals("done") || state.equals("failed")) {
                return id;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("import " + id + " didn't finish");
    }

    private long succeedLingq(String user, String language) throws Exception {
        return await(user, lingq(user, goodKey(), language));
    }

    private long failLingq(String user, String language) throws Exception {
        return await(user, lingq(user, "rejected", language));
    }

    /** My history as "id source language state", newest first. */
    private List<String> history(String user) throws Exception {
        List<String> out = new ArrayList<>();
        for (JsonNode job : api.get(user, "/api/word-imports", 200)) {
            String language = job.get("language").isNull() ? "all" : job.get("language").asString();
            out.add(job.get("id").asLong() + " " + job.get("source").asString() + " " + language + " "
                    + job.get("state").asString());
        }
        return out;
    }

    private static String row(long id, String source, String language, String state) {
        return id + " " + source + " " + language + " " + state;
    }

    private WordImport savedJob(String user, WordImport.Source source, Language language, boolean succeeded) throws Exception {
        WordImport job = new WordImport(api.get(user, "/api/me", 200).get("id").asLong(), source, language, Instant.now());
        if (succeeded) {
            job.finish(Instant.now());
        } else {
            job.fail("earlier", Instant.now());
        }
        return jobs.save(job);
    }

    @Test
    void aSuccessReplacesThePreviousImportForThatSourceAndLanguage() throws Exception {
        succeedLingq(me, "fr");
        long latest = succeedLingq(me, "fr");
        assertThat(history(me)).containsExactly(row(latest, "lingq", "fr", "done"));
    }

    @Test
    void theOldRowStaysUntilTheNewImportSucceeds() throws Exception {
        long old = succeedLingq(me, "fr");
        String key = goodKey();
        YouTubeApiTest.LINGQ.account(key).hold();
        JsonNode started = lingq(me, key, "fr");
        long running = started.get("id").asLong();
        try {
            assertThat(history(me)).hasSize(2).contains(row(old, "lingq", "fr", "done"))
                    .anyMatch(r -> r.startsWith(running + " lingq fr ") && !r.endsWith("done"));
        } finally {
            YouTubeApiTest.LINGQ.account(key).release();
        }
        await(me, started);
        assertThat(history(me)).containsExactly(row(running, "lingq", "fr", "done"));
    }

    @Test
    void aFailureKeepsTheLastSuccessAndReplacesOnlyAnEarlierFailure() throws Exception {
        long success = succeedLingq(me, "fr");
        long firstFailure = failLingq(me, "fr");
        assertThat(history(me)).containsExactly(row(firstFailure, "lingq", "fr", "failed"), row(success, "lingq", "fr", "done"));

        long secondFailure = failLingq(me, "fr");
        assertThat(history(me)).containsExactly(row(secondFailure, "lingq", "fr", "failed"), row(success, "lingq", "fr", "done"));

        long next = succeedLingq(me, "fr");
        assertThat(history(me)).containsExactly(row(next, "lingq", "fr", "done"));
    }

    @Test
    void anAttemptRejectedAtOnceLeavesTheHistoryAlone() throws Exception {
        long success = succeedLingq(me, "fr");
        api.post(me, "/api/word-imports/lingq", "{\"apiKey\":\"has space\",\"language\":\"fr\"}", 400);
        assertThat(history(me)).containsExactly(row(success, "lingq", "fr", "done"));
    }

    @Test
    void otherLanguagesAndAllLanguagesAreSeparateEntries() throws Exception {
        long french = succeedLingq(me, "fr");
        long german = succeedLingq(me, "de");
        long all = succeedLingq(me, null);
        assertThat(history(me)).containsExactly(row(all, "lingq", "all", "done"), row(german, "lingq", "de", "done"),
                row(french, "lingq", "fr", "done"));

        long allAgain = succeedLingq(me, null);
        assertThat(history(me)).containsExactly(row(allAgain, "lingq", "all", "done"), row(german, "lingq", "de", "done"),
                row(french, "lingq", "fr", "done"));
    }

    @Test
    void sourcesDontReplaceEachOtherAndReadlangReplacesItsOwn() throws Exception {
        long lingq = succeedLingq(me, "fr");
        await(me, readlang(me, "fr"));
        long readlang = await(me, readlang(me, "fr"));
        assertThat(history(me)).containsExactly(row(readlang, "readlang", "fr", "done"), row(lingq, "lingq", "fr", "done"));
    }

    @Test
    void anImportCutOffByARestartCountsAsAFailure() throws Exception {
        WordImport success = savedJob(me, WordImport.Source.LINGQ, Language.FR, true);
        savedJob(me, WordImport.Source.LINGQ, Language.FR, false);
        WordImport running = new WordImport(api.get(me, "/api/me", 200).get("id").asLong(), WordImport.Source.LINGQ, Language.FR, Instant.now());
        running.start();
        running = jobs.save(running);
        imports.markInterrupted();
        assertThat(history(me)).containsExactly(row(running.getId(), "lingq", "fr", "failed"),
                row(success.getId(), "lingq", "fr", "done"));
    }

    @Test
    void rowsFromBeforeThisChangeAreAllReplaced() throws Exception {
        for (int i = 0; i < 3; i++) {
            savedJob(me, WordImport.Source.LINGQ, Language.FR, true);
        }
        savedJob(me, WordImport.Source.LINGQ, Language.FR, false);
        long latest = succeedLingq(me, "fr");
        assertThat(history(me)).containsExactly(row(latest, "lingq", "fr", "done"));
    }

    @Test
    void onlyMyOwnHistoryChanges() throws Exception {
        String other = api.signupPro();
        long theirs = succeedLingq(other, "fr");
        succeedLingq(me, "fr");
        assertThat(history(other)).containsExactly(row(theirs, "lingq", "fr", "done"));
    }
}
