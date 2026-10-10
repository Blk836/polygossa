package app.lector.wordimport;

import app.lector.token.Language;
import app.lector.vocab.ImportedWord;
import app.lector.vocab.WordStatus;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class LingqClient {

    static final int PAGE_SIZE = 200;
    static final int MAX_PAGES = 1000;
    static final int MAX_RETRIES = 3;
    static final Duration MAX_WAIT = Duration.ofSeconds(30);
    static final Duration DEFAULT_WAIT = Duration.ofSeconds(5);

    static final String REJECTED = "LingQ didn't accept this API key. Copy it again from lingq.com/accounts/apikey.";
    static final String UNREACHABLE = "LingQ couldn't be reached. Try again later.";
    static final String BUSY = "LingQ is busy. Try again in a few minutes.";

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String[] KNOWN_WORD_FIELDS = {"term", "word", "text"};

    private final URI base;
    private final Duration timeout;
    private final HttpClient http;

    @Autowired
    public LingqClient(@Value("${app.lingq.base-url:https://www.lingq.com}") String baseUrl,
                       @Value("${app.lingq.timeout:20s}") Duration timeout) {
        this.base = URI.create(baseUrl.replaceAll("/+$", ""));
        this.timeout = timeout;
        this.http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(timeout).build();
    }

    public void fetchAll(String apiKey, Language language, Consumer<List<ImportedWord>> onPage) {
        pages(apiKey, "/api/v3/" + language.code() + "/cards/", LingqClient::card, onPage);
        pages(apiKey, "/api/v2/" + language.code() + "/known-words/", LingqClient::knownWord, onPage);
    }

    private void pages(String apiKey, String path, java.util.function.Function<JsonNode, ImportedWord> read,
                       Consumer<List<ImportedWord>> onPage) {
        for (int page = 1; page <= MAX_PAGES; page++) {
            JsonNode body = get(apiKey, path + "?page_size=" + PAGE_SIZE + "&page=" + page);
            if (body == null) {
                return;
            }
            List<ImportedWord> words = new ArrayList<>();
            for (JsonNode item : body.path("results")) {
                ImportedWord w = read.apply(item);
                if (w != null) {
                    words.add(w);
                }
            }
            if (!words.isEmpty()) {
                onPage.accept(words);
            }
            if (body.path("next").isNull() || body.path("next").isMissingNode()) {
                return;
            }
        }
    }

    private JsonNode get(String apiKey, String pathAndQuery) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(base + pathAndQuery)).timeout(timeout)
                .header("Authorization", "Token " + apiKey).header("Accept", "application/json").GET().build();
        for (int attempt = 0; ; attempt++) {
            HttpResponse<String> response = send(request);
            int status = response.statusCode();
            if (status == 429) {
                if (attempt >= MAX_RETRIES) {
                    throw new LingqException(BUSY);
                }
                sleep(retryDelay(response.headers().firstValue("Retry-After").orElse(null)));
                continue;
            }
            return body(status, response.body());
        }
    }

    private static JsonNode body(int status, String body) {
        if (status == 401 || status == 403) {
            throw new LingqException(REJECTED);
        }
        if (status == 404) {
            return null;
        }
        if (status != 200) {
            throw new LingqException(UNREACHABLE);
        }
        try {
            JsonNode node = JSON.readTree(body);
            if (!node.isObject()) {
                throw new LingqException(UNREACHABLE);
            }
            return node;
        } catch (JacksonException e) {
            throw new LingqException(UNREACHABLE);
        }
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new LingqException(UNREACHABLE);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LingqException(UNREACHABLE);
        }
    }

    private static void sleep(Duration wait) {
        try {
            Thread.sleep(wait);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LingqException(UNREACHABLE);
        }
    }

    static Duration retryDelay(String retryAfter) {
        try {
            long seconds = Long.parseLong(retryAfter == null ? "" : retryAfter.trim());
            return Duration.ofSeconds(Math.clamp(seconds, 0, MAX_WAIT.toSeconds()));
        } catch (NumberFormatException e) {
            return DEFAULT_WAIT;
        }
    }

    static WordStatus status(int status, int extended) {
        boolean known = status >= 4 || status == 3 && extended == 3;
        return known ? WordStatus.KNOWN : WordStatus.LEARNING;
    }

    private static ImportedWord card(JsonNode item) {
        String term = text(item.path("term"));
        if (term == null) {
            return null;
        }
        WordStatus status = status(item.path("status").asInt(0), item.path("extended_status").asInt(0));
        return new ImportedWord(term, status, text(item.path("hints").path(0).path("text")), text(item.path("fragment")));
    }

    private static ImportedWord knownWord(JsonNode item) {
        String term = text(item);
        for (int i = 0; term == null && i < KNOWN_WORD_FIELDS.length; i++) {
            term = text(item.path(KNOWN_WORD_FIELDS[i]));
        }
        return term == null ? null : new ImportedWord(term, WordStatus.KNOWN, null, null);
    }

    private static String text(JsonNode node) {
        if (node == null || !node.isString()) {
            return null;
        }
        String s = node.asString().strip();
        return s.isEmpty() ? null : s;
    }
}
