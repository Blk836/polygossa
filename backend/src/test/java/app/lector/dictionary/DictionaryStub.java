package app.lector.dictionary;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;

/**
 * A local stand-in for the Free Dictionary API (under {@link #freeDictionaryUrl()}) and Wiktionary (under
 * {@link #wiktionaryUrl()}, always "not found"), so API tests control what the dictionaries know.
 */
public final class DictionaryStub implements AutoCloseable {

    private final HttpServer server;
    private final Map<String, String> routes = new ConcurrentHashMap<>();

    public DictionaryStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/", exchange -> {
            String path = URLDecoder.decode(exchange.getRequestURI().getRawPath(), StandardCharsets.UTF_8);
            String body = routes.get(path);
            byte[] bytes = (body == null ? "{\"title\":\"Not found\"}" : body).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(body == null ? 404 : 200, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    public String freeDictionaryUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/fd";
    }

    public String wiktionaryUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/wk";
    }

    /** {@code word} in {@code language} has one noun sense, glossed {@code english}. */
    public void define(String language, String word, String english) {
        routes.put("/fd/entries/" + language + "/" + word, """
                {"word":"%s","entries":[{"language":{"code":"%s"},"partOfSpeech":"noun","pronunciations":[],
                  "senses":[{"definition":"%s","examples":[]}]}]}""".formatted(word, language, english));
    }

    /**
     * The English word's one sense translates to {@code word} in {@code language} and to each of {@code natives}
     * (language code, word, language code, word, ...).
     */
    public void translations(String english, String language, String word, String... natives) {
        StringBuilder table = new StringBuilder("{\"language\":{\"code\":\"" + language + "\"},\"word\":\"" + word + "\"}");
        for (int i = 0; i + 1 < natives.length; i += 2) {
            table.append(",{\"language\":{\"code\":\"").append(natives[i]).append("\"},\"word\":\"")
                    .append(natives[i + 1]).append("\"}");
        }
        routes.put("/fd/entries/en/" + english, """
                {"word":"%s","entries":[{"language":{"code":"en"},"partOfSpeech":"noun",
                  "senses":[{"definition":"%s","translations":[%s]}]}]}""".formatted(english, english, table));
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
