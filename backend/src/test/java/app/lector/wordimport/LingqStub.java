package app.lector.wordimport;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A local stand-in for lingq.com's API: paged LingQs ({@code /api/v3/<lang>/cards/}) and known words
 * ({@code /api/v2/<lang>/known-words/}), behind "Authorization: Token <key>". Each API key is its own account, so
 * tests sharing the stub never see each other's data; an unknown key gets 401, like LingQ.
 */
public final class LingqStub implements AutoCloseable {

    private static final Pattern PATH = Pattern.compile("/api/v[23]/([a-z]{2})/(cards|known-words)/");
    private static final Pattern TOKEN = Pattern.compile("Token (\\S+)");

    /** One LingQ account: raw JSON items per language and list ("cards" or "known-words"), and scripted failures. */
    public static final class Account {
        final Map<String, List<String>> items = new ConcurrentHashMap<>();
        /** "list:page" (e.g. "cards:3") → the status that page answers with, every time. */
        final Map<String, Integer> failures = new ConcurrentHashMap<>();
        /** Answer 429 to this many requests first. */
        volatile int rateLimited;
        final List<String> requests = Collections.synchronizedList(new ArrayList<>());

        public Account card(String lang, String json) {
            items.computeIfAbsent(lang + ":cards", k -> Collections.synchronizedList(new ArrayList<>())).add(json);
            return this;
        }

        /** A LingQ with a term, status, extended status, hint and fragment (null leaves the field out). */
        public Account card(String lang, String term, int status, int extended, String hint, String fragment) {
            StringBuilder json = new StringBuilder("{\"pk\":1,\"term\":").append(quote(term))
                    .append(",\"status\":").append(status).append(",\"extended_status\":").append(extended);
            if (hint != null) {
                json.append(",\"hints\":[{\"locale\":\"en\",\"text\":").append(quote(hint)).append("}]");
            }
            if (fragment != null) {
                json.append(",\"fragment\":").append(quote(fragment));
            }
            return card(lang, json.append('}').toString());
        }

        public Account known(String lang, String json) {
            items.computeIfAbsent(lang + ":known-words", k -> Collections.synchronizedList(new ArrayList<>())).add(json);
            return this;
        }

        public Account knownWord(String lang, String word) {
            return known(lang, quote(word));
        }

        public Account fail(String list, int page, int status) {
            failures.put(list + ":" + page, status);
            return this;
        }

        public Account rateLimit(int times) {
            rateLimited = times;
            return this;
        }

        /** Requests received for this key, e.g. "/api/v3/fr/cards/?page_size=200&page=1". */
        public List<String> requests() {
            synchronized (requests) {
                return List.copyOf(requests);
            }
        }
    }

    private final HttpServer server;
    private final Map<String, Account> accounts = new ConcurrentHashMap<>();
    /** Every Authorization header received, for checking that nothing else is sent. */
    private final List<String> authorizations = Collections.synchronizedList(new ArrayList<>());

    public LingqStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    /** The account behind an API key, created empty on first use. */
    public Account account(String apiKey) {
        return accounts.computeIfAbsent(apiKey, k -> new Account());
    }

    public List<String> authorizations() {
        synchronized (authorizations) {
            return List.copyOf(authorizations);
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }

    static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private void handle(HttpExchange ex) throws IOException {
        String auth = ex.getRequestHeaders().getFirst("Authorization");
        authorizations.add(String.valueOf(auth));
        Matcher token = TOKEN.matcher(auth == null ? "" : auth);
        Account account = token.matches() ? accounts.get(token.group(1)) : null;
        if (account == null) {
            send(ex, 401, "{\"detail\":\"Invalid token.\"}", null);
            return;
        }
        String query = ex.getRequestURI().getRawQuery();
        account.requests.add(ex.getRequestURI().getPath() + (query == null ? "" : "?" + query));
        Matcher path = PATH.matcher(ex.getRequestURI().getPath());
        if (!path.matches()) {
            send(ex, 404, "{}", null);
            return;
        }
        if (account.rateLimited > 0) {
            account.rateLimited--;
            send(ex, 429, "{}", "0");
            return;
        }
        Map<String, String> params = params(query);
        int page = Integer.parseInt(params.getOrDefault("page", "1"));
        int size = Integer.parseInt(params.getOrDefault("page_size", "25"));
        Integer failure = account.failures.get(path.group(2) + ":" + page);
        if (failure != null) {
            send(ex, failure, failure == 200 ? "not json" : "{}", null);
            return;
        }
        List<String> all = account.items.getOrDefault(path.group(1) + ":" + path.group(2), List.of());
        int from = Math.min(all.size(), (page - 1) * size);
        int to = Math.min(all.size(), from + size);
        String next = to < all.size() ? "\"https://www.lingq.com/next\"" : "null";
        send(ex, 200, "{\"count\":" + all.size() + ",\"next\":" + next + ",\"previous\":null,\"results\":["
                + String.join(",", all.subList(from, to)) + "]}", null);
    }

    private static Map<String, String> params(String query) {
        Map<String, String> out = new LinkedHashMap<>();
        if (query != null) {
            for (String pair : query.split("&")) {
                int eq = pair.indexOf('=');
                if (eq > 0) {
                    out.put(pair.substring(0, eq), pair.substring(eq + 1));
                }
            }
        }
        return out;
    }

    private static void send(HttpExchange ex, int status, String body, String retryAfter) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        if (retryAfter != null) {
            ex.getResponseHeaders().add("Retry-After", retryAfter);
        }
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
        ex.close();
    }
}
