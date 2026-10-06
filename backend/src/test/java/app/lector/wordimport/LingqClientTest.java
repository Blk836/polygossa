package app.lector.wordimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.token.Language;
import app.lector.vocab.ImportedWord;
import app.lector.vocab.WordStatus;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/** Feature: Import my words from LingQ and Readlang, the LingQ side (docs/acceptance/word-import.feature). */
class LingqClientTest {

    static LingqStub stub;
    static LingqClient client;
    static int keys;

    @BeforeAll
    static void start() throws Exception {
        stub = new LingqStub();
        client = new LingqClient(stub.baseUrl() + "/", Duration.ofSeconds(5));
    }

    @AfterAll
    static void stop() {
        stub.close();
    }

    private static String newKey() {
        return "key" + (++keys);
    }

    private static List<List<ImportedWord>> fetch(String key, Language language) {
        List<List<ImportedWord>> pages = new ArrayList<>();
        client.fetchAll(key, language, pages::add);
        return pages;
    }

    private static List<ImportedWord> all(List<List<ImportedWord>> pages) {
        return pages.stream().flatMap(List::stream).toList();
    }

    @Test
    void readsEveryPageOfLingqsAndKnownWordsWithTheKeyAsAToken() {
        String key = newKey();
        LingqStub.Account account = stub.account(key);
        for (int i = 0; i < 450; i++) {
            account.card("fr", "mot" + i, 0, 0, null, null);
        }
        for (int i = 0; i < 250; i++) {
            account.knownWord("fr", "connu" + i);
        }
        List<List<ImportedWord>> pages = fetch(key, Language.FR);
        assertThat(pages).hasSize(5);
        assertThat(all(pages)).hasSize(700);
        assertThat(all(pages).stream().filter(w -> w.status() == WordStatus.KNOWN)).hasSize(250);
        assertThat(account.requests()).containsExactly(
                "/api/v3/fr/cards/?page_size=200&page=1", "/api/v3/fr/cards/?page_size=200&page=2",
                "/api/v3/fr/cards/?page_size=200&page=3", "/api/v2/fr/known-words/?page_size=200&page=1",
                "/api/v2/fr/known-words/?page_size=200&page=2");
        assertThat(stub.authorizations()).contains("Token " + key);
    }

    @Test
    void anEmptyLanguageGivesNoPages() {
        String key = newKey();
        stub.account(key).card("fr", "maison", 0, 0, null, null);
        assertThat(fetch(key, Language.DE)).isEmpty();
    }

    @Test
    void statusesMapToOurs() {
        assertThat(LingqClient.status(0, 0)).isEqualTo(WordStatus.LEARNING);
        assertThat(LingqClient.status(1, 0)).isEqualTo(WordStatus.LEARNING);
        assertThat(LingqClient.status(2, 0)).isEqualTo(WordStatus.LEARNING);
        assertThat(LingqClient.status(3, 0)).isEqualTo(WordStatus.LEARNING);
        assertThat(LingqClient.status(3, 1)).isEqualTo(WordStatus.LEARNING);
        assertThat(LingqClient.status(3, 3)).isEqualTo(WordStatus.KNOWN);
        assertThat(LingqClient.status(4, 0)).isEqualTo(WordStatus.KNOWN);
        assertThat(LingqClient.status(2, 3)).isEqualTo(WordStatus.LEARNING);
    }

    @Test
    void hintsAndFragmentsComeAlong() {
        String key = newKey();
        stub.account(key).card("fr", "maison", 1, 0, "house", "Une maison bleue")
                .card("fr", "chat", 3, 3, null, null)
                .card("fr", "{\"term\":\"vide\",\"status\":0,\"hints\":[],\"fragment\":\"  \"}");
        List<ImportedWord> words = all(fetch(key, Language.FR));
        assertThat(words).containsExactly(
                new ImportedWord("maison", WordStatus.LEARNING, "house", "Une maison bleue"),
                new ImportedWord("chat", WordStatus.KNOWN, null, null),
                new ImportedWord("vide", WordStatus.LEARNING, null, null));
    }

    @Test
    void unreadableItemsAreSkipped() {
        String key = newKey();
        stub.account(key).card("fr", "{\"status\":0}").card("fr", "{\"term\":\"  \",\"status\":0}")
                .card("fr", "{\"term\":42}").card("fr", "7").card("fr", "maison", 0, 0, null, null)
                .card("fr", "{\"term\":\"sans statut\"}")
                .known("fr", "{\"term\":\"objet\"}").known("fr", "{\"word\":\"mot\"}").known("fr", "{\"text\":\"texte\"}")
                .known("fr", "{\"other\":1}").known("fr", "\"\"").known("fr", "null");
        assertThat(all(fetch(key, Language.FR))).extracting(ImportedWord::term)
                .containsExactly("maison", "sans statut", "objet", "mot", "texte");
    }

    @Test
    void aRejectedKeyFailsWithAHelpfulMessage() {
        assertThatThrownBy(() -> fetch("nobody", Language.FR)).isInstanceOf(LingqException.class)
                .hasMessage("LingQ didn't accept this API key. Copy it again from lingq.com/accounts/apikey.");
        String key = newKey();
        stub.account(key).fail("cards", 1, 403);
        assertThatThrownBy(() -> fetch(key, Language.FR)).isInstanceOf(LingqException.class)
                .hasMessageStartingWith("LingQ didn't accept this API key.");
    }

    @Test
    void rateLimitsAreWaitedOutUpToThreeTimes() {
        String key = newKey();
        stub.account(key).rateLimit(3).card("fr", "maison", 0, 0, null, null);
        assertThat(all(fetch(key, Language.FR))).hasSize(1);

        String impatient = newKey();
        stub.account(impatient).rateLimit(4).card("fr", "maison", 0, 0, null, null);
        assertThatThrownBy(() -> fetch(impatient, Language.FR)).isInstanceOf(LingqException.class)
                .hasMessage("LingQ is busy. Try again in a few minutes.");
    }

    @Test
    void retryAfterIsCappedAtThirtySeconds() {
        assertThat(LingqClient.retryDelay("0")).isEqualTo(Duration.ZERO);
        assertThat(LingqClient.retryDelay("12")).isEqualTo(Duration.ofSeconds(12));
        assertThat(LingqClient.retryDelay("30")).isEqualTo(Duration.ofSeconds(30));
        assertThat(LingqClient.retryDelay("3600")).isEqualTo(Duration.ofSeconds(30));
        assertThat(LingqClient.retryDelay(null)).isEqualTo(Duration.ofSeconds(5));
        assertThat(LingqClient.retryDelay("soon")).isEqualTo(Duration.ofSeconds(5));
        assertThat(LingqClient.retryDelay("-3")).isEqualTo(Duration.ZERO);
    }

    @Test
    void failingPartwayKeepsThePagesAlreadyRead() {
        String key = newKey();
        LingqStub.Account account = stub.account(key);
        for (int i = 0; i < 450; i++) {
            account.card("fr", "mot" + i, 0, 0, null, null);
        }
        account.fail("cards", 3, 502);
        List<List<ImportedWord>> pages = new ArrayList<>();
        assertThatThrownBy(() -> client.fetchAll(key, Language.FR, pages::add)).isInstanceOf(LingqException.class)
                .hasMessage("LingQ couldn't be reached. Try again later.");
        assertThat(pages).hasSize(2);
    }

    @Test
    void anUnreadableReplyOrAnUnreachableServerFails() {
        String key = newKey();
        stub.account(key).fail("cards", 1, 200);
        assertThatThrownBy(() -> fetch(key, Language.FR)).isInstanceOf(LingqException.class)
                .hasMessage("LingQ couldn't be reached. Try again later.");
        LingqClient nowhere = new LingqClient("http://127.0.0.1:1", Duration.ofSeconds(2));
        assertThatThrownBy(() -> nowhere.fetchAll(key, Language.FR, p -> { }))
                .isInstanceOf(LingqException.class).hasMessage("LingQ couldn't be reached. Try again later.");
    }

    @Test
    void notFoundMeansTheLanguageIsEmpty() {
        String key = newKey();
        stub.account(key).fail("cards", 1, 404).knownWord("fr", "connu");
        assertThat(all(fetch(key, Language.FR))).extracting(ImportedWord::term).containsExactly("connu");
    }
}
