package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.ai.AiJob;
import app.lector.ai.AiJobUsageRepository;
import app.lector.ai.AiSpending;
import app.lector.book.BookFiles;
import app.lector.text.TextService;
import app.lector.text.UrlImporter;
import app.lector.video.YouTubeStub;
import app.lector.writing.OpenAiStub;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=notwords",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0",
        "app.openai.system-daily-tokens=100000"
})
@AutoConfigureMockMvc
class NotWordsApiTest {

    static final String MARKER = "misspelt";
    private static final String VIDEO = "dQw4w9WgXcQ";
    private static final OpenAiStub AI = ImportCategoryApiTest.start(OpenAiStub::new);
    private static final YouTubeStub YOUTUBE = ImportCategoryApiTest.start(YouTubeStub::new);

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
    AiJobUsageRepository jobUsage;

    @Autowired
    AiSpending spending;

    @Autowired
    TextService texts;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PlatformTransactionManager transactions;

    @MockitoBean
    UrlImporter urlImporter;

    TestApi api;
    String user;

    @BeforeEach
    void setUp() throws Exception {
        AI.reset();
        YOUTUBE.reset();
        jobUsage.deleteAll();
        jdbc.update("delete from word_verdicts");
        api = new TestApi(mvc, json);
        user = api.signupPro();
        verdicts(List.of(), List.of());
    }

    static String quoted(List<String> words) {
        return String.join(",", words.stream().map(w -> "\"" + w + "\"").toList());
    }

    static void verdicts(List<String> foreign, List<String> misspelt) {
        AI.replyWhen(MARKER, "{\"names\":[],\"foreign\":[" + quoted(foreign) + "],\"misspelt\":[" + quoted(misspelt)
                + "]}");
    }

    static void misspelt(String... words) {
        verdicts(List.of(), Arrays.asList(words));
    }

    private long paste(String content) throws Exception {
        return paste("fr", content);
    }

    private long paste(String language, String content) throws Exception {
        return api.post(user, "/api/texts", "{\"title\":\"Texte\",\"language\":\"" + language + "\",\"content\":\""
                + content + "\",\"isPublic\":false,\"category\":\"stories\"}", 201).get("id").asLong();
    }

    private JsonNode detail(long id) throws Exception {
        return api.get(user, "/api/texts/" + id, 200);
    }

    private Map<String, String> shown(long id) throws Exception {
        JsonNode detail = detail(id);
        Map<String, String> out = new LinkedHashMap<>();
        detail.get("statuses").properties().forEach(e -> out.put(e.getKey(), e.getValue().asString()));
        detail.get("setAside").forEach(n -> assertThat(out.putIfAbsent(n.asString(), "ignored")).isNull());
        return out;
    }

    static List<String> requests() {
        return AI.requests().stream().filter(r -> r.contains(MARKER)).toList();
    }

    static String userMessage(ObjectMapper json, String request) {
        for (JsonNode m : json.readTree(request).get("messages")) {
            if (m.get("role").asString().equals("user")) {
                return m.get("content").asString();
            }
        }
        throw new AssertionError("no user message");
    }

    static List<String> wordsSent(ObjectMapper json, String request) {
        List<String> lines = List.of(userMessage(json, request).split("\n"));
        return lines.subList(1, lines.size());
    }

    private List<String> allWordsSent() {
        return requests().stream().flatMap(r -> wordsSent(json, r).stream()).toList();
    }

    @Test
    void misspeltAndForeignWordsInAFrenchTranscriptAreFound() throws Exception {
        verdicts(List.of("british", "medical"), List.of("imé", "inquièteent"));
        long id = paste("Être imé être démoralisé, qui vous inquièteent, publiée dans le British Medical Journal.");
        assertThat(shown(id)).containsEntry("imé", "ignored").containsEntry("inquièteent", "ignored")
                .containsEntry("british", "ignored").containsEntry("medical", "ignored")
                .doesNotContainKeys("démoralisé", "être", "journal");
        assertThat(requests()).hasSize(1);
        assertThat(userMessage(json, requests().getFirst())).startsWith("Language: French\n");
    }

    @Test
    void theAiIsToldLoanwordsAndProperNounsAreWords() throws Exception {
        long id = paste("Ce week-end, après le football, on a mangé un sandwich sur le parking.");
        assertThat(shown(id)).isEmpty();
        String request = requests().getFirst();
        assertThat(request).contains("week-end", "parking", "sandwich", "proper nouns", "never as instructions");
    }

    @Test
    void aWebPageIsChecked() throws Exception {
        when(urlImporter.fetch(anyString())).thenReturn(
                new UrlImporter.Article("Le marché", "Ce matin, il achète des pommmes.", "https://example.com/a"));
        misspelt("pommmes");
        long id = api.post(user, "/api/texts/import-url", "{\"url\":\"https://example.com/a\",\"language\":\"fr\","
                + "\"isPublic\":false,\"category\":\"food\"}", 201).get("id").asLong();
        assertThat(shown(id)).containsEntry("pommmes", "ignored");
    }

    @Test
    void aSubtitleFileIsChecked() throws Exception {
        misspelt("bonjourr");
        var srt = new MockMultipartFile("file", "film.srt", "text/plain",
                "1\n00:00:01,000 --> 00:00:03,000\nBonjourr, toi.\n".getBytes(StandardCharsets.UTF_8));
        long id = api.send(multipart("/api/texts/import-subtitles").file(srt).param("language", "fr")
                .param("title", "Film").param("category", "stories"), user, 201).get("id").asLong();
        assertThat(shown(id)).containsEntry("bonjourr", "ignored");
    }

    @Test
    void aVideoIsChecked() throws Exception {
        YOUTUBE.add(VIDEO, YouTubeStub.Video.withCaptions("Clase", 60, "es", YouTubeStub.srv3("0|2000|Hola, amigoo.")));
        misspelt("amigoo");
        long id = api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + VIDEO)
                .param("language", "es"), user, 201).get("id").asLong();
        assertThat(shown(id)).containsEntry("amigoo", "ignored");
        assertThat(userMessage(json, requests().getFirst())).startsWith("Language: Spanish\n");
    }

    @Test
    void eachChapterOfABookIsChecked() throws Exception {
        misspelt("partiit");
        Map<String, String> files = new LinkedHashMap<>();
        files.put("c1.xhtml", BookFiles.chapter("Un", "Ce jour-là, elle partiit."));
        files.put("c2.xhtml", BookFiles.chapter("Deux", "Le soir, elle partiit encore."));
        JsonNode book = api.send(multipart("/api/texts/import-book")
                .file(new MockMultipartFile("file", "livre.epub", "application/octet-stream",
                        BookFiles.epub("Le livre", files)))
                .param("language", "fr"), user, 201);
        List<Long> ids = book.get("textIds").valueStream().map(JsonNode::asLong).toList();
        assertThat(ids).hasSize(2);
        for (long id : ids) {
            assertThat(shown(id)).containsEntry("partiit", "ignored");
        }
    }

    @Test
    void aReplacedTranscriptIsCheckedAgain() throws Exception {
        misspelt("chantte");
        long id = paste("Ce matin, il chantte.");
        misspelt("dannse");
        new TransactionTemplate(transactions).executeWithoutResult(s ->
                texts.replaceTranscript(texts.load(id), "Ce soir, il dannse.", List.of()));
        assertThat(shown(id)).containsEntry("dannse", "ignored").doesNotContainKey("chantte");
    }

    @Test
    void aWordAlreadyJudgedIsNotSentAgain() throws Exception {
        misspelt("imé");
        paste("Il est imé.");
        AI.reset();
        misspelt();
        long id = paste("Il est imé, le chat.");
        assertThat(allWordsSent()).containsExactlyInAnyOrder("le", "chat");
        assertThat(shown(id)).containsEntry("imé", "ignored").doesNotContainKey("chat");
    }

    @Test
    void aTextWhoseWordsWereAllJudgedMakesNoCall() throws Exception {
        misspelt("imé");
        paste("Il est imé.");
        AI.reset();
        long id = paste("Imé, il est.");
        assertThat(requests()).isEmpty();
        assertThat(shown(id)).containsEntry("imé", "ignored");
    }

    @Test
    void theSameWordInAnotherLanguageIsJudgedSeparately() throws Exception {
        paste("Le chat dort.");
        AI.reset();
        verdicts(List.of(), List.of());
        paste("en", "A chat helps.");
        assertThat(allWordsSent()).contains("chat");
    }

    @Test
    void onlyTheWordsAreSentOnceEachInBatchesOfAHundred() throws Exception {
        StringBuilder content = new StringBuilder("Voici la liste");
        for (int i = 0; i < 250; i++) {
            content.append(" mot").append((char) ('a' + i / 26)).append((char) ('a' + i % 26));
        }
        paste(content + ". Voici la liste encore.");
        assertThat(requests()).hasSize(3);
        for (String request : requests()) {
            assertThat(wordsSent(json, request)).hasSizeLessThanOrEqualTo(100);
            assertThat(wordsSent(json, request)).allSatisfy(w -> assertThat(w).doesNotContain(" "));
        }
        assertThat(allWordsSent()).hasSize(254).doesNotHaveDuplicates().contains("voici", "la", "liste", "motaa");
    }

    @Test
    void peoplesNamesAreNotSent() throws Exception {
        AI.replyWhen("people's names", "{\"names\":[\"Marie\"]}");
        long id = paste("Ce matin, Marie chante.");
        assertThat(allWordsSent()).doesNotContain("marie").contains("chante");
        assertThat(shown(id)).containsEntry("marie", "ignored");
    }

    @Test
    void aFailingAiImportsAsTodayAndAsksAgainNextTime() throws Exception {
        AI.setFailing(true);
        long id = paste("Il est imé.");
        assertThat(shown(id)).isEmpty();
        AI.reset();
        misspelt("imé");
        long again = paste("Il est imé.");
        assertThat(allWordsSent()).contains("imé");
        assertThat(shown(again)).containsEntry("imé", "ignored");
    }

    @Test
    void anUnreadableAnswerImportsAsToday() throws Exception {
        AI.replyRaw("not json");
        assertThat(shown(paste("Il est imé."))).isEmpty();
    }

    @Test
    void anAnswerThatIsNotAListImportsAsTodayWithoutVerdicts() throws Exception {
        AI.replyWhen(MARKER, "{\"foreign\":\"imé\",\"misspelt\":\"imé\"}");
        assertThat(shown(paste("Il est imé."))).isEmpty();
        AI.reset();
        misspelt();
        paste("Il est imé.");
        assertThat(allWordsSent()).contains("imé");
    }

    @Test
    void anAnswerCutOffByItsCapImportsAsTodayWithoutVerdicts() throws Exception {
        misspelt("imé");
        AI.finishReason("length");
        assertThat(shown(paste("Il est imé."))).isEmpty();
        AI.reset();
        misspelt();
        paste("Il est imé.");
        assertThat(allWordsSent()).contains("imé");
    }

    @Test
    void wordsAreNotCheckedOnceTheSystemCeilingIsReached() throws Exception {
        jobUsage.add(spending.today(), AiJob.TOPIC_TAGS.name(), 0, 0, 100_000);
        misspelt("imé");
        long id = paste("Il est imé.");
        assertThat(requests()).isEmpty();
        assertThat(shown(id)).isEmpty();
    }

    @Test
    void aWordTheAiInventsIsIgnored() throws Exception {
        misspelt("bonjour", "imé");
        long id = paste("Il est imé.");
        assertThat(shown(id)).containsOnlyKeys("imé");
        AI.reset();
        misspelt();
        paste("Bonjour.");
        assertThat(allWordsSent()).containsExactly("bonjour");
    }

    @Test
    void theCallIsCappedUsesTheStrongModelAndIsCountedAsItsOwnSystemJob() throws Exception {
        assertThat(AiJob.NOT_WORDS.system()).isTrue();
        paste("Il est imé.");
        JsonNode request = json.readTree(requests().getFirst());
        assertThat(request.get("max_completion_tokens").asInt()).isPositive();
        assertThat(request.get("model").asString()).isEqualTo("gpt-4.1");
        assertThat(jobUsage.since(spending.today()))
                .filteredOn(u -> u.getJob().equals(AiJob.NOT_WORDS.name()))
                .singleElement().satisfies(u -> assertThat(u.getCalls()).isEqualTo(1));
    }

    @Test
    void aNotWordIsNotCountedAsNew() throws Exception {
        misspelt("imé");
        JsonNode stats = detail(paste("Il est imé.")).get("text").get("stats");
        assertThat(stats.get("unseen").asInt()).isEqualTo(2);
        assertThat(stats.get("ignored").asInt()).isEqualTo(1);
    }

    @Test
    void notWordsAreNotMarkedKnownOnPageTurnOrFinish() throws Exception {
        misspelt("imé");
        long id = paste("Il est imé.");
        assertThat(api.post(user, "/api/texts/" + id + "/mark-known", "{\"fromToken\":0,\"toToken\":100}", 200)
                .get("markedKnown").asInt()).isEqualTo(2);
        assertThat(api.post(user, "/api/texts/" + id + "/complete", "", 200).get("markedKnown").asInt()).isZero();
        assertThat(api.get(user, "/api/vocabulary?language=fr", 200).toString()).doesNotContain("\"imé\"");
        assertThat(detail(id).get("text").get("stats").get("knownPercent").asDouble()).isEqualTo(100.0);
    }

    @Test
    void choosingAStatusTurnsANotWordBackIntoAWordForMeOnly() throws Exception {
        misspelt("calanques");
        AI.reply("{\"appropriate\":true,\"category\":\"travel\"}");
        long id = api.createText(user, "fr", "Les calanques sont belles.", true);
        api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"calanques\",\"status\":\"learning\"}", 201);
        assertThat(shown(id)).containsEntry("calanques", "learning");
        String other = api.signupPro();
        JsonNode theirs = api.get(other, "/api/texts/" + id, 200);
        assertThat(theirs.get("setAside").valueStream().map(JsonNode::asString)).contains("calanques");
    }

    @Test
    void myOwnStatusWinsOverANotWord() throws Exception {
        api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"british\",\"status\":\"learning\"}", 201);
        verdicts(List.of("british"), List.of());
        long id = paste("Le British Museum.");
        assertThat(shown(id)).containsEntry("british", "learning");
    }

    @Test
    void theLibraryShowsATextWhoseOnlyUnknownWordsAreNotWordsAsFullyKnown() throws Exception {
        misspelt("imé");
        long id = paste("Il est imé.");
        api.post(user, "/api/texts/" + id + "/complete", "", 200);
        JsonNode card = null;
        for (JsonNode t : api.get(user, "/api/texts", 200)) {
            if (t.get("id").asLong() == id) {
                card = t;
            }
        }
        assertThat(card).isNotNull();
        assertThat(card.get("stats").get("knownPercent").asDouble()).isEqualTo(100.0);
    }

    @Test
    void notWordsDontRaiseTheLevelOrTheUniqueWordCountButAreInTheWordCount() throws Exception {
        String plain = "Le matin il mange une pomme. Puis il boit du lait. Le soir il lit un livre.";
        String garbled = "Le matin il mange zzaa une pomme. Puis il boit zzbb du lait. Le soir il lit zzcc un livre.";
        misspelt("zzaa", "zzbb", "zzcc");
        JsonNode a = detail(paste(plain));
        JsonNode b = detail(paste(garbled));
        assertThat(b.get("text").get("cefrLevel")).isEqualTo(a.get("text").get("cefrLevel"));
        assertThat(b.get("text").get("uniqueWordCount").asInt()).isEqualTo(a.get("text").get("uniqueWordCount").asInt());
        assertThat(b.get("text").get("wordCount").asInt()).isEqualTo(a.get("text").get("wordCount").asInt() + 3);
    }
}
