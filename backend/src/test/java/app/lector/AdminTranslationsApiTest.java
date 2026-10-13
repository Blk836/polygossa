package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.translation.TranslateStub;
import app.lector.writing.OpenAiStub;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "test.database=admin-translations",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads",
        "app.openai.api-key=test-key",
        "app.openai.daily-limit=0",
        "app.openai.meaning-timeout=1s",
        "app.translation.enabled=true",
        "app.translation.region=eu-west-1",
        "app.translation.timeout=1s",
        "app.translation.monthly-character-cap=5000000",
        "app.lookup-prices.translate-per-million-characters=20",
        "app.lookup-prices.ai-input-per-million-tokens=0.3",
        "app.lookup-prices.ai-output-per-million-tokens=1.2"
})
@AutoConfigureMockMvc
class AdminTranslationsApiTest {

    private static final TranslateStub TRANSLATE;
    private static final OpenAiStub AI;

    static {
        try {
            TRANSLATE = new TranslateStub();
            AI = new OpenAiStub();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        System.setProperty("aws.accessKeyId", "test");
        System.setProperty("aws.secretAccessKey", "test");
    }

    @DynamicPropertySource
    static void stubs(DynamicPropertyRegistry registry) {
        registry.add("app.translation.endpoint", TRANSLATE::endpoint);
        registry.add("app.openai.base-url", AI::baseUrl);
    }

    @AfterAll
    static void stop() {
        TRANSLATE.close();
        AI.close();
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    Clock clock;

    private TestApi api;
    private String admin;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        TRANSLATE.reset();
        AI.reset();
        String body = "{\"email\":\"" + AdminApiTest.ADMIN + "\",\"password\":\"password123\"}";
        var signup = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse();
        String reply = signup.getStatus() == 201 ? signup.getContentAsString()
                : mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString();
        admin = "Bearer " + json.readTree(reply).get("token").asString();
    }

    private static String fresh() {
        StringBuilder s = new StringBuilder("w");
        for (int i = 0; i < 9; i++) {
            s.append((char) ('a' + ThreadLocalRandom.current().nextInt(26)));
        }
        return s.toString();
    }

    private String learner(String nativeLanguage) throws Exception {
        String token = api.signup();
        api.patch(token, "/api/me", "{\"nativeLanguage\":\"" + nativeLanguage + "\"}", 200);
        return token;
    }

    private void lookup(String token, String language, String term, String before, String after) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/dictionary").param("language", language).param("term", term);
        if (before != null) {
            request.param("before", before).param("after", after);
        }
        api.send(request, token, 200);
    }

    private void lookup(String term, String before, String after) throws Exception {
        lookup(learner("en"), "fr", term, before, after);
    }

    private JsonNode report(int days) throws Exception {
        return api.get(admin, "/api/admin/translations?days=" + days, 200);
    }

    private JsonNode pair(String source, String target) throws Exception {
        for (JsonNode p : report(30).get("pairs")) {
            if (p.get("source").asString().equals(source) && p.get("target").asString().equals(target)) {
                return p;
            }
        }
        return json.readTree("{\"lookups\":0,\"layers\":{},\"stored\":{}}");
    }

    private JsonNode frEn() throws Exception {
        return pair("fr", "en");
    }

    private static long n(JsonNode row, String path) {
        JsonNode node = row;
        for (String part : path.split("\\.")) {
            node = node.path(part);
        }
        return node.asLong(0);
    }

    private static long delta(JsonNode before, JsonNode after, String path) {
        return n(after, path) - n(before, path);
    }

    private LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private void counter(LocalDate day, String source, String target, String layer, long lookups, long characters,
                         long tokensIn, long tokensOut) {
        jdbc.update("""
                insert into lookup_counters (day, source_language, target_language, layer, lookups, translate_calls,
                    translate_characters, translate_failures, translate_capped, ai_calls, ai_tokens_in,
                    ai_tokens_out, ai_failures)
                values (?, ?, ?, ?, ?, 0, ?, 0, 0, 0, ?, ?, 0)""", day, source, target, layer, lookups, characters,
                tokensIn, tokensOut);
    }

    @Test
    void aNewAndAStoredAiMeaningAreCountedApart() throws Exception {
        String word = fresh();
        AI.reply("{\"meaning\":\"standing\"}");
        JsonNode before = frEn();
        lookup(word, "si on est ", " sur la table.");
        lookup(word, "si on est ", " sur la table.");
        JsonNode after = frEn();
        assertThat(delta(before, after, "layers.aiNew")).isEqualTo(1);
        assertThat(delta(before, after, "layers.aiStored")).isEqualTo(1);
        assertThat(delta(before, after, "lookups")).isEqualTo(2);
        assertThat(delta(before, after, "stored.sentenceMeanings")).isEqualTo(1);
    }

    @Test
    void aCommunityMeaningIsCountedAsCommunity() throws Exception {
        String word = fresh();
        for (int i = 0; i < 2; i++) {
            api.post(learner("en"), "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + word
                    + "\",\"meaning\":\"limp\"}", 201);
        }
        String alone = fresh();
        api.post(learner("en"), "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + alone
                + "\",\"meaning\":\"limp\"}", 201);
        JsonNode before = frEn();
        lookup(word, null, null);
        JsonNode after = frEn();
        assertThat(delta(before, after, "layers.community")).isEqualTo(1);
        assertThat(n(after, "stored.communityWords")).isGreaterThanOrEqualTo(1);
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void aNewAndAStoredMachineTranslationAreCountedApart() throws Exception {
        String word = fresh();
        JsonNode before = frEn();
        lookup(word, null, null);
        lookup(word, null, null);
        JsonNode after = frEn();
        assertThat(delta(before, after, "layers.machineNew")).isEqualTo(1);
        assertThat(delta(before, after, "layers.machineStored")).isEqualTo(1);
        assertThat(delta(before, after, "translateCalls")).isEqualTo(1);
        assertThat(delta(before, after, "translateCharacters")).isEqualTo(word.length());
        assertThat(delta(before, after, "stored.machineWords")).isEqualTo(1);
        assertThat(delta(before, after, "stored.machineNoUse")).isZero();
    }

    @Test
    void aLookupWithNoMeaningIsCountedAsNothingFound() throws Exception {
        TRANSLATE.echo(true);
        JsonNode before = frEn();
        lookup(fresh(), null, null);
        JsonNode after = frEn();
        assertThat(delta(before, after, "layers.none")).isEqualTo(1);
        assertThat(delta(before, after, "stored.machineWords")).isEqualTo(1);
        assertThat(delta(before, after, "stored.machineNoUse")).isEqualTo(1);
    }

    @Test
    void eachLanguagePairHasItsOwnRow() throws Exception {
        JsonNode esFrBefore = pair("es", "fr");
        JsonNode frEnBefore = frEn();
        lookup(learner("fr"), "es", fresh(), null, null);
        assertThat(delta(esFrBefore, pair("es", "fr"), "lookups")).isEqualTo(1);
        assertThat(delta(frEnBefore, frEn(), "lookups")).isZero();
    }

    @Test
    void aWordInMyOwnNativeLanguageIsNotCounted() throws Exception {
        JsonNode before = report(30).get("total");
        lookup(learner("fr"), "fr", fresh(), null, null);
        assertThat(delta(before, report(30).get("total"), "lookups")).isZero();
        assertThat(TRANSLATE.requests()).isEmpty();
    }

    @Test
    void lookupsAtTheSameMomentAllCount() throws Exception {
        String word = fresh();
        lookup(word, null, null);
        List<String> learners = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            learners.add(learner("en"));
        }
        JsonNode before = frEn();
        ExecutorService pool = Executors.newFixedThreadPool(10);
        try {
            List<Callable<Void>> calls = learners.stream().<Callable<Void>>map(t -> () -> {
                lookup(t, "fr", word, null, null);
                return null;
            }).toList();
            for (Future<Void> f : pool.invokeAll(calls)) {
                f.get();
            }
        } finally {
            pool.shutdown();
        }
        assertThat(delta(before, frEn(), "layers.machineStored")).isEqualTo(10);
    }

    @Test
    void amazonCallsAndCharactersAreCountedOnTheLookupTheyServed() throws Exception {
        String word = fresh();
        TRANSLATE.answer(word, "en", word);
        String marked = "Hier, je <b>" + word + "</b> dans la rue.";
        TRANSLATE.answer(marked, "en", "Yesterday I <b>was limping</b> in the street.");
        JsonNode before = frEn();
        lookup(word, "Hier, je ", " dans la rue.");
        JsonNode after = frEn();
        assertThat(delta(before, after, "layers.machineNew")).isEqualTo(1);
        assertThat(delta(before, after, "translateCalls")).isEqualTo(2);
        assertThat(delta(before, after, "translateCharacters")).isEqualTo(word.length() + marked.length());
    }

    @Test
    void theAiTokensAreCountedFromItsReply() throws Exception {
        AI.reply("{\"meaning\":\"standing\"}");
        AI.usage(120, 8);
        JsonNode before = frEn();
        lookup(fresh(), "si on est ", " sur la table.");
        JsonNode after = frEn();
        assertThat(delta(before, after, "aiCalls")).isEqualTo(1);
        assertThat(delta(before, after, "aiTokensIn")).isEqualTo(120);
        assertThat(delta(before, after, "aiTokensOut")).isEqualTo(8);
    }

    @Test
    void aLookupThatUsedBothServicesCountsBoth() throws Exception {
        AI.usage(50, 3);
        String word = fresh();
        JsonNode before = frEn();
        lookup(word, "si on est ", " sur la table.");
        JsonNode after = frEn();
        assertThat(delta(before, after, "layers.machineNew")).isEqualTo(1);
        assertThat(delta(before, after, "aiCalls")).isEqualTo(1);
        assertThat(delta(before, after, "aiTokensIn")).isEqualTo(50);
        assertThat(delta(before, after, "aiTokensOut")).isEqualTo(3);
        assertThat(delta(before, after, "translateCalls")).isEqualTo(1);
        assertThat(delta(before, after, "translateCharacters")).isEqualTo(word.length());
    }

    @Test
    void failedCallsAreCountedAsFailures() throws Exception {
        AI.setFailing(true);
        AI.usage(120, 8);
        TRANSLATE.failing(true);
        JsonNode before = frEn();
        lookup(fresh(), "si on est ", " sur la table.");
        JsonNode after = frEn();
        assertThat(delta(before, after, "layers.none")).isEqualTo(1);
        assertThat(delta(before, after, "aiCalls")).isEqualTo(1);
        assertThat(delta(before, after, "aiFailures")).isEqualTo(1);
        assertThat(delta(before, after, "aiTokensIn")).isZero();
        assertThat(delta(before, after, "translateCalls")).isEqualTo(1);
        assertThat(delta(before, after, "translateFailures")).isEqualTo(1);
    }

    @Test
    void timedOutCallsAreCountedAsFailures() throws Exception {
        AI.delay(Duration.ofMillis(1500));
        TRANSLATE.delay(1500);
        JsonNode before = frEn();
        lookup(fresh(), "si on est ", " sur la table.");
        JsonNode after = frEn();
        assertThat(delta(before, after, "aiFailures")).isEqualTo(1);
        assertThat(delta(before, after, "translateFailures")).isEqualTo(1);
    }

    @Test
    void aLookupRefusedByTheCapIsCountedAsRefused() throws Exception {
        String month = YearMonth.now(clock.withZone(ZoneOffset.UTC)).toString();
        Long was = jdbc.query("select characters from translation_usage where month = ?",
                rs -> rs.next() ? rs.getLong(1) : null, month);
        jdbc.update("insert into translation_usage (month, characters) values (?, 5000000) "
                + "on conflict (month) do update set characters = 5000000", month);
        try {
            JsonNode before = frEn();
            lookup(fresh(), null, null);
            JsonNode after = frEn();
            assertThat(delta(before, after, "translateCapped")).isEqualTo(1);
            assertThat(delta(before, after, "translateCalls")).isZero();
            assertThat(delta(before, after, "translateCharacters")).isZero();
            assertThat(delta(before, after, "layers.none")).isEqualTo(1);
            assertThat(report(30).get("month").get("characters").asLong()).isEqualTo(5000000);
        } finally {
            jdbc.update("update translation_usage set characters = ? where month = ?", was == null ? 0 : was, month);
        }
    }

    @Test
    void thePeriodTheCostAndTheTotal() throws Exception {
        counter(today().minusDays(5), "DE", "PL", "MACHINE_NEW", 1000, 200_000, 1_000_000, 100_000);
        counter(today().minusDays(40), "DE", "PL", "COMMUNITY", 7, 0, 0, 0);
        JsonNode dePl = pair("de", "pl");
        assertThat(n(dePl, "lookups")).isEqualTo(1000);
        assertThat(n(dePl, "layers.machineNew")).isEqualTo(1000);
        assertThat(dePl.get("hitRate").asDouble()).isZero();
        assertThat(dePl.get("cost").asDouble()).isCloseTo(4.0 + 0.3 + 0.12, within(1e-9));
        assertThat(dePl.get("costPer1000Lookups").asDouble()).isCloseTo(4.42, within(1e-9));

        JsonNode ninety = report(90);
        long sum = 0;
        for (JsonNode p : ninety.get("pairs")) {
            sum += n(p, "lookups");
            if (p.get("source").asString().equals("de")) {
                assertThat(n(p, "lookups")).isEqualTo(1007);
                assertThat(p.get("hitRate").asDouble()).isCloseTo(7.0 / 1007, within(1e-9));
            }
        }
        assertThat(n(ninety.get("total"), "lookups")).isEqualTo(sum);
        assertThat(ninety.get("prices").get("translatePerMillionCharacters").asDouble()).isEqualTo(20);
    }

    @Test
    void aPairWithNothingLookedUpHasNoCostPerThousand() throws Exception {
        jdbc.update("insert into machine_translations (source_language, target_language, term, translation, "
                + "created_at, tried_in_context) values ('IT', 'SV', ?, 'x', now(), false)", fresh());
        JsonNode itSv = pair("it", "sv");
        assertThat(n(itSv, "lookups")).isZero();
        assertThat(n(itSv, "stored.machineWords")).isGreaterThanOrEqualTo(1);
        assertThat(itSv.get("costPer1000Lookups").isNull()).isTrue();
        assertThat(itSv.get("hitRate").isNull()).isTrue();
    }

    @Test
    void theTrendHasEveryDayOfThePeriod() throws Exception {
        counter(today().minusDays(3), "DE", "SV", "AI_NEW", 4, 0, 1_000_000, 0);
        JsonNode trend = report(7).get("trend");
        assertThat(trend).hasSize(7);
        assertThat(trend.get(6).get("day").asString()).isEqualTo(today().toString());
        assertThat(trend.get(0).get("day").asString()).isEqualTo(today().minusDays(6).toString());
        JsonNode day = trend.get(3);
        assertThat(day.get("day").asString()).isEqualTo(today().minusDays(3).toString());
        assertThat(n(day, "layers.aiNew")).isGreaterThanOrEqualTo(4);
        assertThat(day.get("cost").asDouble()).isGreaterThanOrEqualTo(0.3);
    }

    @Test
    void thisMonthAgainstTheCap() throws Exception {
        JsonNode month = report(30).get("month");
        assertThat(month.get("month").asString()).isEqualTo(YearMonth.now(clock.withZone(ZoneOffset.UTC)).toString());
        assertThat(month.get("cap").asLong()).isEqualTo(5_000_000);
    }

    @Test
    void onlyASensiblePeriodAndOnlyAdmins() throws Exception {
        api.get(admin, "/api/admin/translations?days=0", 400);
        api.get(admin, "/api/admin/translations?days=366", 400);
        assertThat(api.get(api.signup(), "/api/admin/translations", 403).get("code").asString())
                .isEqualTo("forbidden");
    }
}
