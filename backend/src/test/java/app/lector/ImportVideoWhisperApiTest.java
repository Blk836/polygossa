package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.text.TextRepository;
import app.lector.video.AudioTranscription;
import app.lector.video.AudioTranscriptionRepository;
import app.lector.video.FakeYtDlp;
import app.lector.video.ProcessRunner;
import app.lector.video.YouTubeStub;
import app.lector.writing.OpenAiStub;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=importwhisper",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.youtube.audio.enabled=true",
        "app.youtube.audio.cookies-from-browser=firefox",
        "app.transcription.max-minutes=30",
        "app.transcription.budget-usd=10",
        "app.transcription.usd-per-minute=0.006",
        "app.transcription.max-audio-bytes=2000"
})
@AutoConfigureMockMvc
@Import(ImportVideoWhisperApiTest.Config.class)
class ImportVideoWhisperApiTest {

    private static final String BLOCKED = "AAAAAAAAAAA";
    private static final String NO_FRENCH = "BBBBBBBBBBB";
    private static final String CAPTIONED = "CCCCCCCCCCC";
    private static final String LONG = "DDDDDDDDDDD";
    private static final OpenAiStub AI = ImportCategoryApiTest.start(OpenAiStub::new);
    private static final YouTubeStub YOUTUBE = ImportCategoryApiTest.start(YouTubeStub::new);
    private static final FakeYtDlp YT_DLP = new FakeYtDlp();
    private static final String WAY = " — upload a subtitle file or paste the transcript";

    static final String HEARD = """
            {"task":"transcribe","language":"french","duration":598.4,"text":"Bonjour, ça va ? Très bien.",
             "segments":[{"id":0,"start":1.0,"end":2.4,"text":" Bonjour, ça va ?","no_speech_prob":0.01},
                         {"id":1,"start":2.6,"end":4.0,"text":" Très bien.","no_speech_prob":0.02}],
             "words":[{"word":"Bonjour","start":1.0,"end":1.5},{"word":"ça","start":1.9,"end":2.1},
                      {"word":"va","start":2.15,"end":2.4},{"word":"Très","start":2.6,"end":3.0},
                      {"word":"bien","start":3.1,"end":3.9}]}""";

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        ProcessRunner fakeYtDlp() {
            return YT_DLP;
        }
    }

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
        registry.add("app.openai.base-url", AI::baseUrl);
        registry.add("app.youtube.base-url", YOUTUBE::baseUrl);
    }

    @AfterAll
    static void stop() {
        AI.close();
        YOUTUBE.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    TextRepository texts;

    @Autowired
    AudioTranscriptionRepository transcriptions;

    @Autowired
    TransactionTemplate tx;

    TestApi api;
    String user;
    long textsBefore;

    @BeforeEach
    void setUp() throws Exception {
        AI.reset();
        AI.reply("{\"appropriate\":true,\"category\":\"news\"}");
        AI.transcription(HEARD);
        YOUTUBE.reset();
        YOUTUBE.add(BLOCKED, new YouTubeStub.Video("Journal en français facile", 200, null, Map.of()));
        YOUTUBE.add(NO_FRENCH, new YouTubeStub.Video("Les infos", 200, 600, Map.of()));
        YOUTUBE.add(CAPTIONED, YouTubeStub.Video.withCaptions("La cuisine", 90, "fr",
                YouTubeStub.srv3("0|3000|Bonjour les amis.")));
        YOUTUBE.add(LONG, new YouTubeStub.Video("Long", 200, 45 * 60, Map.of()));
        YT_DLP.reset();
        transcriptions.deleteAll();
        api = new TestApi(mvc, json);
        user = api.signupPro();
        textsBefore = texts.count();
    }

    private MockMultipartHttpServletRequestBuilder importReq(String video) {
        return (MockMultipartHttpServletRequestBuilder) multipart("/api/texts/import-youtube")
                .param("url", "https://www.youtube.com/watch?v=" + video).param("language", "fr");
    }

    private JsonNode importVideo(String video, int status) throws Exception {
        return api.send(importReq(video), user, status);
    }

    private void noNewTexts() {
        assertThat(texts.count()).isEqualTo(textsBefore);
    }

    private void spent(long seconds) {
        transcriptions.save(new AudioTranscription("ZZZZZZZZZZZ", seconds, Instant.parse("2026-10-01T00:00:00Z")));
    }

    private void nothingDownloadedOrSpent() {
        assertThat(YT_DLP.downloads()).isEmpty();
        assertThat(AI.transcriptionRequests()).isEmpty();
        assertThat(transcriptions.findAll()).isEmpty();
        noNewTexts();
    }

    @Test
    void aVideoWhoseCaptionsCantBeReadIsImportedFromItsAudio() throws Exception {
        JsonNode r = importVideo(BLOCKED, 201);
        assertThat(r.get("title").asString()).isEqualTo("Journal en français facile");

        List<String> download = YT_DLP.downloads().getFirst();
        assertThat(download).contains("--cookies-from-browser", "firefox", "https://www.youtube.com/watch?v=" + BLOCKED);
        assertThat(AI.transcriptionRequests().getFirst()).contains("whisper-1").contains("OggS-fake-opus-audio");

        JsonNode text = api.get(user, "/api/texts/" + r.get("id").asLong(), 200);
        String content = tx.execute(s -> texts.findById(r.get("id").asLong()).orElseThrow().getContent());
        assertThat(content).isEqualTo("Bonjour, ça va ?\nTrès bien.");
        assertThat(text.get("video").get("timings").findValuesAsString("s"))
                .containsExactly("1000", "1900", "2150", "2600", "3100");
        assertThat(text.get("video").get("durationSeconds").asInt()).isEqualTo(599);
        assertThat(transcriptions.findAll()).singleElement()
                .satisfies(t -> assertThat(t.getAudioSeconds()).isEqualTo(599));
    }

    @Test
    void aLengthFromYouTubeIsUsedWithoutAskingYtDlp() throws Exception {
        importVideo(NO_FRENCH, 201);
        assertThat(YT_DLP.commands()).hasSize(1);
        assertThat(YT_DLP.downloads()).hasSize(1);
    }

    @Test
    void readableCaptionsAreUsedAsBefore() throws Exception {
        importVideo(CAPTIONED, 201);
        assertThat(YT_DLP.commands()).isEmpty();
        assertThat(AI.transcriptionRequests()).isEmpty();
    }

    @Test
    void aPastedTranscriptWins() throws Exception {
        api.send(importReq(BLOCKED).param("transcript", "Bonjour tout le monde."), user, 201);
        assertThat(YT_DLP.commands()).isEmpty();
        assertThat(AI.transcriptionRequests()).isEmpty();
    }

    @Test
    void aVideoOverTheLengthLimitIsRefusedBeforeDownloading() throws Exception {
        JsonNode err = importVideo(LONG, 422);
        assertThat(err.get("code").asString()).isEqualTo("too_long");
        assertThat(err.get("message").asString())
                .isEqualTo("45 min is over the 30-minute limit for videos without captions" + WAY);
        nothingDownloadedOrSpent();
    }

    @Test
    void aVideoWhoseLengthCantBeFoundIsRefused() throws Exception {
        YT_DLP.setDuration(null);
        JsonNode err = importVideo(BLOCKED, 422);
        assertThat(err.get("code").asString()).isEqualTo("no_captions");
        assertThat(err.get("message").asString())
                .isEqualTo("Couldn't read this video's captions or find its length" + WAY);
        nothingDownloadedOrSpent();
    }

    @Test
    void theSpendingCapStopsTranscription() throws Exception {
        spent(99_500);
        JsonNode err = importVideo(BLOCKED, 422);
        assertThat(err.get("code").asString()).isEqualTo("over_budget");
        assertThat(err.get("message").asString()).contains("$9.95").contains("$10").endsWith(WAY);
        assertThat(YT_DLP.downloads()).isEmpty();
        assertThat(AI.transcriptionRequests()).isEmpty();
        noNewTexts();
    }

    @Test
    void anAudioDownloadThatFailsSaysWhy() throws Exception {
        YT_DLP.fail("Video unavailable");
        JsonNode err = importVideo(BLOCKED, 422);
        assertThat(err.get("code").asString()).isEqualTo("no_captions");
        assertThat(err.get("message").asString())
                .isEqualTo("Couldn't read this video's captions or download its audio (ERROR: Video unavailable)" + WAY);
        assertThat(AI.transcriptionRequests()).isEmpty();
        assertThat(transcriptions.findAll()).isEmpty();
        noNewTexts();
    }

    @Test
    void audioTooBigForWhisperIsRefused() throws Exception {
        YT_DLP.setAudio(new byte[2001]);
        JsonNode err = importVideo(BLOCKED, 422);
        assertThat(err.get("code").asString()).isEqualTo("audio_too_big");
        assertThat(AI.transcriptionRequests()).isEmpty();
        noNewTexts();
    }

    @Test
    void musicOrSilenceIsRefusedButPaidFor() throws Exception {
        AI.transcription("""
                {"language":"french","duration":598,"text":"","segments":[],"words":[]}""");
        JsonNode err = importVideo(BLOCKED, 422);
        assertThat(err.get("code").asString()).isEqualTo("no_speech");
        assertThat(err.get("message").asString()).contains("no speech found");
        noNewTexts();
        assertThat(transcriptions.findAll()).singleElement()
                .satisfies(t -> assertThat(t.getAudioSeconds()).isEqualTo(598));
    }

    @Test
    void speechInAnotherLanguageIsRefused() throws Exception {
        AI.transcription(HEARD.replace("\"french\"", "\"english\""));
        JsonNode err = importVideo(BLOCKED, 422);
        assertThat(err.get("message").asString()).contains("English").contains("French");
        noNewTexts();
    }

    @Test
    void whenWhisperFailsNothingIsSavedOrCounted() throws Exception {
        AI.setTranscriptionFailing(true);
        JsonNode err = importVideo(BLOCKED, 502);
        assertThat(err.get("code").asString()).isEqualTo("ai_error");
        assertThat(err.get("message").asString()).contains("try again");
        noNewTexts();
        assertThat(transcriptions.findAll()).isEmpty();
    }

    @Test
    void thePlanLimitComesFirst() throws Exception {
        String free = api.signup();
        for (int i = 0; i < 5; i++) {
            api.createText(free, "fr", "Bonjour " + i + ".", false);
        }
        api.send(importReq(BLOCKED), free, 402);
        assertThat(YT_DLP.commands()).isEmpty();
        assertThat(AI.transcriptionRequests()).isEmpty();
    }
}
