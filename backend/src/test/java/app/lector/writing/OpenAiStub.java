package app.lector.writing;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import tools.jackson.databind.json.JsonMapper;

/**
 * A local stand-in for an OpenAI-compatible chat completions endpoint. Answers every request with the configured JSON
 * object as the assistant's message, or with an HTTP error when failing.
 */
public final class OpenAiStub implements AutoCloseable {

    private final HttpServer server;
    private final List<String> requests = Collections.synchronizedList(new ArrayList<>());
    private volatile String reply = "{}";
    private volatile boolean failing;

    public OpenAiStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", this::handle);
        server.start();
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    /** The JSON object the "model" answers with. */
    public void reply(String json) {
        this.reply = json;
    }

    public void setFailing(boolean failing) {
        this.failing = failing;
    }

    /** Request bodies received so far. */
    public List<String> requests() {
        synchronized (requests) {
            return List.copyOf(requests);
        }
    }

    public void reset() {
        requests.clear();
        reply = "{}";
        failing = false;
    }

    @Override
    public void close() {
        server.stop(0);
    }

    private void handle(HttpExchange ex) throws IOException {
        requests.add(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        if (failing) {
            send(ex, 500, "{\"error\":\"boom\"}");
            return;
        }
        String content = JsonMapper.builder().build().writeValueAsString(reply);
        send(ex, 200, "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":" + content + "}}]}");
    }

    private static void send(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }
}
