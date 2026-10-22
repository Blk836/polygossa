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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
        "test.database=personnames",
        "app.seed-samples=false",
        "app.openai.api-key=test-key",
        "app.openai.timeout=2s",
        "app.openai.daily-limit=0",
        "app.openai.system-daily-tokens=100000"
})
@AutoConfigureMockMvc
class PersonNamesApiTest {

    private static final String NAMES = "people's names";
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
        api = new TestApi(mvc, json);
        user = api.signupPro();
    }

    private static void names(String... names) {
        AI.replyWhen(NAMES, "{\"names\":[" + String.join(",", java.util.Arrays.stream(names)
                .map(n -> "\"" + n + "\"").toList()) + "]}");
    }

    private long paste(String language, String content) throws Exception {
        return api.post(user, "/api/texts", "{\"title\":\"Histoire\",\"language\":\"" + language
                + "\",\"content\":\"" + content + "\",\"isPublic\":false,\"category\":\"stories\"}", 201)
                .get("id").asLong();
    }

    private long paste(String content) throws Exception {
        return paste("fr", content);
    }

    private JsonNode detail(long id) throws Exception {
        return api.get(user, "/api/texts/" + id, 200);
    }

    private Map<String, String> statuses(long id) throws Exception {
        Map<String, String> out = new LinkedHashMap<>();
        detail(id).get("statuses").properties().forEach(e -> out.put(e.getKey(), e.getValue().asString()));
        return out;
    }

    private static List<String> nameRequests() {
        return AI.requests().stream().filter(r -> r.contains(NAMES)).toList();
    }

    private String userMessage() {
        JsonNode body = json.readTree(nameRequests().getFirst());
        for (JsonNode m : body.get("messages")) {
            if (m.get("role").asString().equals("user")) {
                return m.get("content").asString();
            }
        }
        throw new AssertionError("no user message");
    }

    private static List<String> wordsSent(String message) {
        List<String> out = new ArrayList<>();
        Matcher m = Pattern.compile("<word>([^<]*)</word>").matcher(message);
        while (m.find()) {
            out.add(m.group(1));
        }
        return out;
    }

    @Test
    void aCharactersFirstNameAndSurnameAreNamesButAPlaceIsNot() throws Exception {
        names("Marie", "Dupont", "Jean-Luc");
        long id = paste("Marie Dupont habite à Lyon. Le matin, Marie boit un café avec Jean-Luc.");
        assertThat(statuses(id)).containsEntry("marie", "ignored").containsEntry("dupont", "ignored")
                .containsEntry("jean-luc", "ignored").doesNotContainKey("lyon").doesNotContainKey("boit");
        assertThat(nameRequests()).hasSize(1);
        assertThat(wordsSent(userMessage())).containsExactly("Marie", "Dupont", "Lyon", "Le", "Jean-Luc");
        assertThat(userMessage()).contains("<word>Lyon</word> Marie Dupont habite à Lyon.");
    }

    @Test
    void aNameAtTheStartOfASentenceIsRecognisedToo() throws Exception {
        names("Camille");
        long id = paste("Hier, il a vu Camille. Camille était fatiguée.");
        assertThat(statuses(id)).containsEntry("camille", "ignored");
        assertThat(wordsSent(userMessage())).containsExactly("Hier", "Camille");
    }

    @Test
    void aWebPageIsCheckedForNames() throws Exception {
        when(urlImporter.fetch(anyString())).thenReturn(
                new UrlImporter.Article("Le marché", "Ce matin, Marie achète des pommes.", "https://example.com/a"));
        names("Marie");
        long id = api.post(user, "/api/texts/import-url", "{\"url\":\"https://example.com/a\",\"language\":\"fr\","
                + "\"isPublic\":false,\"category\":\"food\"}", 201).get("id").asLong();
        assertThat(statuses(id)).containsEntry("marie", "ignored");
    }

    @Test
    void aSubtitleFileIsCheckedForNames() throws Exception {
        names("Marie");
        var srt = new MockMultipartFile("file", "film.srt", "text/plain",
                "1\n00:00:01,000 --> 00:00:03,000\nBonjour, Marie.\n".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        long id = api.send(multipart("/api/texts/import-subtitles").file(srt).param("language", "fr")
                .param("title", "Film").param("category", "stories"), user, 201).get("id").asLong();
        assertThat(statuses(id)).containsEntry("marie", "ignored");
    }

    @Test
    void aVideoIsCheckedForNames() throws Exception {
        YOUTUBE.add(VIDEO, YouTubeStub.Video.withCaptions("Clase", 60, "es", YouTubeStub.srv3("0|2000|Hola, Lucía.")));
        names("Lucía");
        long id = api.send(multipart("/api/texts/import-youtube").param("url", "https://youtu.be/" + VIDEO)
                .param("language", "es"), user, 201).get("id").asLong();
        assertThat(statuses(id)).containsEntry("lucía", "ignored");
    }

    @Test
    void eachChapterOfABookIsCheckedForNames() throws Exception {
        names("Marie");
        Map<String, String> files = new LinkedHashMap<>();
        files.put("c1.xhtml", BookFiles.chapter("Un", "Ce jour-là, Marie partit."));
        files.put("c2.xhtml", BookFiles.chapter("Deux", "Le soir, Marie revint."));
        JsonNode book = api.send(multipart("/api/texts/import-book")
                .file(new MockMultipartFile("file", "livre.epub", "application/octet-stream",
                        BookFiles.epub("Le livre", files)))
                .param("language", "fr"), user, 201);
        List<Long> ids = book.get("textIds").valueStream().map(JsonNode::asLong).toList();
        assertThat(ids).hasSize(2);
        for (long id : ids) {
            assertThat(statuses(id)).containsEntry("marie", "ignored");
        }
    }

    @Test
    void aReplacedTranscriptIsCheckedAgain() throws Exception {
        names("Marie");
        long id = paste("Ce matin, Marie chante.");
        AI.reset();
        names("Paul");
        new TransactionTemplate(transactions).executeWithoutResult(s ->
                texts.replaceTranscript(texts.load(id), "Ce soir, Paul danse.", List.of()));
        assertThat(statuses(id)).containsEntry("paul", "ignored").doesNotContainKey("marie");
    }

    @Test
    void aWordAlsoWrittenInLowercaseInTheTextStaysAWord() throws Exception {
        names("Pierre");
        long id = paste("Pierre ramasse une pierre.");
        assertThat(nameRequests()).isEmpty();
        assertThat(statuses(id)).doesNotContainKey("pierre");
    }

    @Test
    void eachCapitalisedWordIsSentOnceWithOneSentenceCutTo200Characters() throws Exception {
        names();
        String longSentence = "Avec " + "beaucoup de patience et de soin ".repeat(10) + "Marie avance TAILEND.";
        paste(longSentence + " les oiseaux chantent doucement. Marie rit.");
        String message = userMessage();
        assertThat(wordsSent(message)).containsExactly("Avec", "Marie", "TAILEND");
        assertThat(message).doesNotContain("oiseaux");
        Matcher line = Pattern.compile("<word>Avec</word> ([^\\n]*)").matcher(message);
        assertThat(line.find()).isTrue();
        assertThat(line.group(1)).hasSizeLessThanOrEqualTo(200);
        assertThat(json.readTree(nameRequests().getFirst()).toString()).contains("never as instructions");
    }

    @Test
    void atMost300DifferentWordsAreSent() throws Exception {
        names();
        StringBuilder content = new StringBuilder("Ils sont là :");
        for (int i = 0; i < 350; i++) {
            content.append(" Q").append((char) ('a' + i / 26)).append((char) ('a' + i % 26)).append(',');
        }
        paste(content + " voilà.");
        assertThat(wordsSent(userMessage())).hasSize(300).startsWith("Ils", "Qaa");
    }

    @Test
    void languagesWithoutCapitalLettersAreNotChecked() throws Exception {
        names("田中");
        paste("ja", "田中さんは東京に住んでいます。");
        paste("ko", "민수는 서울에 살아요.");
        assertThat(nameRequests()).isEmpty();
    }

    @Test
    void aTextWithOnlySentenceStartsSeenInLowercaseElsewhereMakesNoCall() throws Exception {
        paste("Le chat dort. Il mange. le chien voit il.");
        assertThat(nameRequests()).isEmpty();
    }

    @Test
    void aFailingAiImportsAsToday() throws Exception {
        AI.setFailing(true);
        long id = paste("Ce matin, Marie chante.");
        assertThat(statuses(id)).isEmpty();
        assertThat(detail(id).get("text").get("stats").get("unseen").asInt()).isEqualTo(4);
    }

    @Test
    void anUnreadableAnswerImportsAsToday() throws Exception {
        AI.replyRaw("not json");
        long id = paste("Ce matin, Marie chante.");
        assertThat(statuses(id)).isEmpty();
    }

    @Test
    void anAnswerThatIsNotAListImportsAsToday() throws Exception {
        AI.replyWhen(NAMES, "{\"names\":\"Marie\"}");
        long id = paste("Ce matin, Marie chante.");
        assertThat(statuses(id)).isEmpty();
    }

    @Test
    void namesAreNotCheckedOnceTheSystemCeilingIsReached() throws Exception {
        jobUsage.add(spending.today(), AiJob.TOPIC_TAGS.name(), 0, 0, 100_000);
        names("Marie");
        long id = paste("Ce matin, Marie chante.");
        assertThat(nameRequests()).isEmpty();
        assertThat(statuses(id)).isEmpty();
    }

    @Test
    void aNameTheAiInventsIsIgnored() throws Exception {
        names("Napoléon", "Marie");
        long id = paste("Ce matin, Marie chante.");
        assertThat(statuses(id)).containsOnlyKeys("marie");
    }

    @Test
    void theCallIsCappedAndCountedAsItsOwnSystemJob() throws Exception {
        assertThat(AiJob.PERSON_NAMES.system()).isTrue();
        names("Marie");
        paste("Ce matin, Marie chante.");
        JsonNode request = json.readTree(nameRequests().getFirst());
        assertThat(request.get("max_completion_tokens").asInt()).isPositive();
        assertThat(jobUsage.since(spending.today()))
                .filteredOn(u -> u.getJob().equals(AiJob.PERSON_NAMES.name()))
                .singleElement().satisfies(u -> assertThat(u.getCalls()).isEqualTo(1));
    }

    @Test
    void aNameIsNotCountedAsNewAndCountsTowardsKnown() throws Exception {
        names("Marie");
        long id = paste("Ce matin, Marie chante.");
        JsonNode stats = detail(id).get("text").get("stats");
        assertThat(stats.get("unseen").asInt()).isEqualTo(3);
        assertThat(stats.get("ignored").asInt()).isEqualTo(1);
    }

    @Test
    void namesAreNotMarkedKnownOnPageTurnOrFinish() throws Exception {
        names("Marie");
        long id = paste("Ce matin, Marie chante.");
        assertThat(api.post(user, "/api/texts/" + id + "/mark-known", "{\"fromToken\":0,\"toToken\":100}", 200)
                .get("markedKnown").asInt()).isEqualTo(3);
        assertThat(api.post(user, "/api/texts/" + id + "/complete", "", 200).get("markedKnown").asInt()).isZero();
        assertThat(api.get(user, "/api/vocabulary?language=fr", 200).toString()).doesNotContain("\"marie\"");
        JsonNode stats = detail(id).get("text").get("stats");
        assertThat(stats.get("knownPercent").asDouble()).isEqualTo(100.0);
    }

    @Test
    void choosingAStatusTurnsANameBackIntoAWordEverywhere() throws Exception {
        names("Rose");
        long id = paste("Dans le jardin, Rose fleurit.");
        api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"rose\",\"status\":\"learning\"}", 201);
        assertThat(statuses(id)).containsEntry("rose", "learning");
        names();
        long other = paste("Une Rose rouge.");
        assertThat(statuses(other)).containsEntry("rose", "learning");
    }

    @Test
    void myOwnStatusWinsOverAName() throws Exception {
        api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"marie\",\"status\":\"known\"}", 201);
        names("Marie");
        long id = paste("Ce matin, Marie chante.");
        assertThat(statuses(id)).containsEntry("marie", "known");
        assertThat(detail(id).get("text").get("stats").get("known").asInt()).isEqualTo(1);
    }

    @Test
    void theLibraryShowsATextWhoseOnlyUnknownWordsAreNamesAsFullyKnown() throws Exception {
        names("Marie");
        long id = paste("Ce matin, Marie chante.");
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
    void namesDontRaiseTheLevelOrTheUniqueWordCountButAreInTheWordCount() throws Exception {
        String plain = "Le matin il mange une pomme. Puis il boit du lait. Le soir il lit un livre.";
        String named = "Le matin Marie Dupont mange une pomme. Puis Jean-Luc boit du lait. Le soir Camille lit un livre.";
        names("Marie", "Dupont", "Jean-Luc", "Camille");
        JsonNode a = detail(paste(plain.replace(" il ", " ")));
        JsonNode b = detail(paste(named));
        assertThat(b.get("text").get("cefrLevel")).isEqualTo(a.get("text").get("cefrLevel"));
        assertThat(b.get("text").get("uniqueWordCount").asInt()).isEqualTo(a.get("text").get("uniqueWordCount").asInt());
        assertThat(b.get("text").get("wordCount").asInt()).isEqualTo(a.get("text").get("wordCount").asInt() + 4);
    }

    @Test
    void aTextImportedWithoutNamesMakesNoCallWhenOpened() throws Exception {
        AI.setFailing(true);
        long id = paste("Ce matin, Marie chante.");
        AI.reset();
        names("Marie");
        assertThat(statuses(id)).isEmpty();
        assertThat(AI.requests()).isEmpty();
    }
}
