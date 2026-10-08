package app.lector.translation;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * A local stand-in for Amazon Translate's TranslateText (the AWS JSON protocol), so tests never call AWS. It answers
 * from {@link #answer} (else "[target] text"), and can fail, be slow, or echo the text back.
 */
public final class TranslateStub implements AutoCloseable {

    /** One TranslateText request as received. */
    public record Request(String text, String source, String target) {}

    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpServer server;
    private final List<Request> requests = Collections.synchronizedList(new ArrayList<>());
    private final Map<String, String> answers = new ConcurrentHashMap<>();
    private volatile boolean failing;
    private volatile boolean echo;
    private volatile long delayMillis;

    public TranslateStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/", this::handle);
        server.start();
    }

    public String endpoint() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    /** Translates {@code text} into {@code target} as {@code translation}. */
    public void answer(String text, String target, String translation) {
        answers.put(target + ":" + text, translation);
    }

    public void failing(boolean value) {
        failing = value;
    }

    /** Answers with the text unchanged (as for a name). */
    public void echo(boolean value) {
        echo = value;
    }

    public void delay(long millis) {
        delayMillis = millis;
    }

    public List<Request> requests() {
        synchronized (requests) {
            return List.copyOf(requests);
        }
    }

    public void reset() {
        requests.clear();
        answers.clear();
        failing = false;
        echo = false;
        delayMillis = 0;
    }

    private void handle(HttpExchange exchange) throws IOException {
        JsonNode body = JSON.readTree(exchange.getRequestBody().readAllBytes());
        Request request = new Request(body.path("Text").asString(""), body.path("SourceLanguageCode").asString(""),
                body.path("TargetLanguageCode").asString(""));
        requests.add(request);
        if (delayMillis > 0) {
            try {
                Thread.sleep(delayMillis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        if (failing) {
            send(exchange, 500, "{\"__type\":\"InternalServerException\",\"message\":\"stub failure\"}");
            return;
        }
        String translated = echo ? request.text()
                : answers.getOrDefault(request.target() + ":" + request.text(), "[" + request.target() + "] " + request.text());
        send(exchange, 200, JSON.writeValueAsString(Map.of("TranslatedText", translated,
                "SourceLanguageCode", request.source(), "TargetLanguageCode", request.target())));
    }

    private static void send(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/x-amz-json-1.1");
        try {
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        } catch (IOException e) {
            // The client gave up (a timeout test); nothing to answer.
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
