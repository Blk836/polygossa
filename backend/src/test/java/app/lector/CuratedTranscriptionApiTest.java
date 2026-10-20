package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.curator.AudioTranscription;
import app.lector.curator.AudioTranscriptionRepository;
import app.lector.seed.SampleContentSeeder;
import app.lector.text.Text;
import app.lector.text.TextRepository;
import app.lector.user.UserRepository;
import app.lector.video.YouTubeStub;
import app.lector.writing.OpenAiStub;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=curatedtranscription",
        "app.seed-samples=false",
        "app.curator-token=" + CuratedVideoImportApiTest.TOKEN,
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.transcription.max-minutes=30",
        "app.transcription.budget-usd=10",
        "app.transcription.usd-per-minute=0.006",
        "app.transcription.max-audio-bytes=2000"
})
@AutoConfigureMockMvc
class CuratedTranscriptionApiTest {

    private static final String SILENT = "AAAAAAAAAAA";
    private static final String CAPTIONED = "BBBBBBBBBBB";
    private static final String LONG = "CCCCCCCCCCC";
    private static final String UNKNOWN_LENGTH = "DDDDDDDDDDD";
    private static final OpenAiStub AI = ImportCategoryApiTest.start(OpenAiStub::new);
    private static final YouTubeStub YOUTUBE = ImportCategoryApiTest.start(YouTubeStub::new);

    static final String HEARD = """
            {"task":"transcribe","language":"spanish","duration":600.4,"text":"Hola, ¿qué tal? Muy bien.",
             "segments":[{"id":0,"start":1.0,"end":2.4,"text":" Hola, ¿qué tal?","no_speech_prob":0.01},
                         {"id":1,"start":2.6,"end":4.0,"text":" Muy bien.","no_speech_prob":0.02}],
             "words":[{"word":"Hola","start":1.0,"end":1.5},{"word":"qué","start":1.9,"end":2.1},
                      {"word":"tal","start":2.15,"end":2.4},{"word":"Muy","start":2.6,"end":3.0},
                      {"word":"bien","start":3.1,"end":3.9}]}""";

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
    UserRepository users;

    @Autowired
    AudioTranscriptionRepository transcriptions;

    @Autowired
    TransactionTemplate tx;

    TestApi api;

    @BeforeEach
    void setUp() {
        AI.reset();
        AI.reply("{\"appropriate\":true,\"category\":\"news\"}");
        AI.transcription(HEARD);
        YOUTUBE.reset();
        YOUTUBE.add(SILENT, new YouTubeStub.Video("Noticias", 200, 600, Map.of()));
        YOUTUBE.add(CAPTIONED, YouTubeStub.Video.withCaptions("La cocina", 90, "es",
                YouTubeStub.srv3("0|3000|Hola amigos.")));
        YOUTUBE.add(LONG, new YouTubeStub.Video("Largo", 200, 45 * 60, Map.of()));
        YOUTUBE.add(UNKNOWN_LENGTH, new YouTubeStub.Video("Sin duración", 200, null, Map.of()));
        api = new TestApi(mvc, json);
        transcriptions.deleteAll();
        tx.executeWithoutResult(s -> libraryVideos().forEach(texts::delete));
    }

    private JsonNode quote(String video, int status) throws Exception {
        return api.send(MockMvcRequestBuilders.post("/api/curator/transcriptions/quote")
                .contentType(MediaType.APPLICATION_JSON)
                .header(CuratedVideoImportApiTest.HEADER, CuratedVideoImportApiTest.TOKEN)
                .content("{\"url\":\"https://youtu.be/" + video + "\",\"language\":\"es\"}"), null, status);
    }

    private JsonNode transcribe(String video, byte[] audio, int status) throws Exception {
        return api.send(multipart("/api/curator/transcriptions")
                .file(new MockMultipartFile("audio", "audio.webm", "audio/webm", audio))
                .param("url", "https://youtu.be/" + video).param("language", "es").param("category", "news")
                .header(CuratedVideoImportApiTest.HEADER, CuratedVideoImportApiTest.TOKEN), null, status);
    }

    private static byte[] audio() {
        return "OggS-fake-opus-audio".getBytes(StandardCharsets.ISO_8859_1);
    }

    private List<Text> libraryVideos() {
        return users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL)
                .map(u -> texts.findAll().stream().filter(t -> t.getOwner().getId().equals(u.getId())).toList())
                .orElse(List.of());
    }

    private void spent(long seconds) {
        transcriptions.save(new AudioTranscription("ZZZZZZZZZZZ", seconds, Instant.parse("2026-10-01T00:00:00Z")));
    }

    @Test
    void aVideoWithoutCaptionsIsQuotedWithItsLengthAndCost() throws Exception {
        JsonNode q = quote(SILENT, 200);
        assertThat(q.get("outcome").asString()).isEqualTo("would_transcribe");
        assertThat(q.get("durationSeconds").asInt()).isEqualTo(600);
        assertThat(q.get("costUsd").asDouble()).isEqualTo(0.06);
        assertThat(AI.transcriptionRequests()).isEmpty();
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void aVideoWithCaptionsIsQuotedAsHavingThem() throws Exception {
        assertThat(quote(CAPTIONED, 200).get("outcome").asString()).isEqualTo("has_captions");
    }

    @Test
    void theAudioBecomesAWordTimedTranscriptInTheLibrary() throws Exception {
        JsonNode r = transcribe(SILENT, audio(), 201);
        assertThat(r.get("outcome").asString()).isEqualTo("transcribed");
        assertThat(r.get("title").asString()).isEqualTo("Noticias");
        String sent = AI.transcriptionRequests().getFirst();
        assertThat(sent).startsWith("multipart/form-data").contains("whisper-1").contains("verbose_json")
                .contains("word").contains("OggS-fake-opus-audio");

        List<Text> saved = libraryVideos();
        assertThat(saved).hasSize(1);
        String content = tx.execute(s -> texts.findById(saved.getFirst().getId()).orElseThrow().getContent());
        assertThat(content).isEqualTo("Hola, ¿qué tal?\nMuy bien.");
        assertThat(saved.getFirst().isPublic()).isTrue();
        String learner = api.signupPro();
        JsonNode timings = api.get(learner, "/api/texts/" + r.get("id").asLong(), 200).get("video").get("timings");
        assertThat(timings.size()).isEqualTo(5);
        assertThat(timings.findValuesAsString("s")).containsExactly("1000", "1900", "2150", "2600", "3100");
    }

    @Test
    void whatWhisperHeardIsAddedToTheSpending() throws Exception {
        transcribe(SILENT, audio(), 201);
        assertThat(transcriptions.findAll()).singleElement()
                .satisfies(t -> assertThat(t.getAudioSeconds()).isEqualTo(601));
    }

    @Test
    void aVideoWithCaptionsIsNotTranscribed() throws Exception {
        assertThat(transcribe(CAPTIONED, audio(), 200).get("outcome").asString()).isEqualTo("has_captions");
        assertThat(AI.transcriptionRequests()).isEmpty();
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void aVideoAlreadyInTheLibraryIsNotTranscribedAgain() throws Exception {
        transcribe(SILENT, audio(), 201);
        assertThat(quote(SILENT, 200).get("outcome").asString()).isEqualTo("already_imported");
        assertThat(transcribe(SILENT, audio(), 200).get("outcome").asString()).isEqualTo("already_imported");
        assertThat(AI.transcriptionRequests()).hasSize(1);
    }

    @Test
    void aVideoOverTheLengthLimitIsRefusedWithoutCallingWhisper() throws Exception {
        JsonNode q = quote(LONG, 200);
        assertThat(q.get("outcome").asString()).isEqualTo("too_long");
        assertThat(q.get("message").asString()).contains("45 min").contains("30");
        assertThat(transcribe(LONG, audio(), 200).get("outcome").asString()).isEqualTo("too_long");
        assertThat(AI.transcriptionRequests()).isEmpty();
    }

    @Test
    void aVideoOfUnknownLengthIsRefused() throws Exception {
        assertThat(quote(UNKNOWN_LENGTH, 200).get("outcome").asString()).isEqualTo("unknown_length");
        assertThat(transcribe(UNKNOWN_LENGTH, audio(), 200).get("outcome").asString()).isEqualTo("unknown_length");
        assertThat(AI.transcriptionRequests()).isEmpty();
    }

    @Test
    void theSpendingCapStopsTranscription() throws Exception {
        spent(99_500);
        JsonNode q = quote(SILENT, 200);
        assertThat(q.get("outcome").asString()).isEqualTo("over_budget");
        assertThat(q.get("message").asString()).contains("$9.95").contains("$10");
        assertThat(transcribe(SILENT, audio(), 200).get("outcome").asString()).isEqualTo("over_budget");
        assertThat(AI.transcriptionRequests()).isEmpty();
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void audioTooBigForWhisperIsRefused() throws Exception {
        JsonNode r = transcribe(SILENT, new byte[2001], 400);
        assertThat(r.get("code").asString()).isEqualTo("audio_too_big");
        assertThat(AI.transcriptionRequests()).isEmpty();
    }

    @Test
    void musicOrSilenceIsRefusedButPaidFor() throws Exception {
        AI.transcription("""
                {"language":"spanish","duration":600,"text":"","segments":[],"words":[]}""");
        JsonNode r = transcribe(SILENT, audio(), 422);
        assertThat(r.get("code").asString()).isEqualTo("no_speech");
        assertThat(r.get("message").asString()).contains("no speech found");
        assertThat(libraryVideos()).isEmpty();
        assertThat(transcriptions.findAll()).hasSize(1);
    }

    @Test
    void segmentsWhisperThinksAreNotSpeechCountAsNoSpeech() throws Exception {
        AI.transcription("""
                {"language":"spanish","duration":600,"text":"Gracias.",
                 "segments":[{"start":0,"end":2,"text":" Gracias.","no_speech_prob":0.9}],
                 "words":[{"word":"Gracias","start":0,"end":1}]}""");
        assertThat(transcribe(SILENT, audio(), 422).get("code").asString()).isEqualTo("no_speech");
    }

    @Test
    void speechInAnotherLanguageIsRefused() throws Exception {
        AI.transcription(HEARD.replace("\"spanish\"", "\"english\""));
        JsonNode r = transcribe(SILENT, audio(), 422);
        assertThat(r.get("code").asString()).isEqualTo("no_speech");
        assertThat(r.get("message").asString()).contains("English").contains("Spanish");
        assertThat(libraryVideos()).isEmpty();
    }

    @Test
    void whenWhisperFailsNothingIsSavedOrCounted() throws Exception {
        AI.setTranscriptionFailing(true);
        assertThat(transcribe(SILENT, audio(), 502).get("code").asString()).isEqualTo("ai_error");
        assertThat(libraryVideos()).isEmpty();
        assertThat(transcriptions.findAll()).isEmpty();
    }

    @Test
    void theTranscribedVideoExportsWithItsWordTimings() throws Exception {
        long id = transcribe(SILENT, audio(), 201).get("id").asLong();
        JsonNode exported = api.send(MockMvcRequestBuilders.get("/api/curator/videos/" + SILENT + "/copy")
                .param("language", "es")
                .header(CuratedVideoImportApiTest.HEADER, CuratedVideoImportApiTest.TOKEN), null, 200);
        tx.executeWithoutResult(s -> texts.deleteById(id));
        int whisperCalls = AI.transcriptionRequests().size();
        ((tools.jackson.databind.node.ObjectNode) exported).put("dryRun", false);
        long copied = api.send(MockMvcRequestBuilders.post("/api/curator/copies").contentType(MediaType.APPLICATION_JSON)
                .header(CuratedVideoImportApiTest.HEADER, CuratedVideoImportApiTest.TOKEN)
                .content(exported.toString()), null, 201).get("id").asLong();
        JsonNode timings = api.get(api.signupPro(), "/api/texts/" + copied, 200).get("video").get("timings");
        assertThat(timings.findValuesAsString("s")).containsExactly("1000", "1900", "2150", "2600", "3100");
        assertThat(AI.transcriptionRequests()).hasSize(whisperCalls);
    }

    @Test
    void aWrongTokenIsRefused() throws Exception {
        api.send(multipart("/api/curator/transcriptions")
                .file(new MockMultipartFile("audio", "audio.webm", "audio/webm", audio()))
                .param("url", "https://youtu.be/" + SILENT).param("language", "es")
                .header(CuratedVideoImportApiTest.HEADER, "wrong"), null, 401);
        assertThat(AI.transcriptionRequests()).isEmpty();
    }
}
