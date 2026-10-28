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

public final class OpenAiStub implements AutoCloseable {

    private final HttpServer server;
    private final List<String> requests = Collections.synchronizedList(new ArrayList<>());
    private volatile String reply = "{}";
    private volatile boolean failing;
    private volatile String rawContent;
    private volatile long delayMillis;
    private final java.util.concurrent.atomic.AtomicLong nextDelayMillis = new java.util.concurrent.atomic.AtomicLong();
    private final java.util.Queue<Integer> nextStatuses = new java.util.concurrent.ConcurrentLinkedQueue<>();
    private volatile String usage = "";
    private volatile String finishReason = "stop";
    private final java.util.Map<String, String> repliesWhen = java.util.Collections.synchronizedMap(new java.util.LinkedHashMap<>());
    private final List<String> embeddingRequests = Collections.synchronizedList(new ArrayList<>());
    private final java.util.Map<String, float[]> vectorsWhen = java.util.Collections.synchronizedMap(new java.util.LinkedHashMap<>());
    private volatile float[] defaultVector = {1, 0, 0};
    private volatile boolean embeddingsFailing;
    private volatile String rawEmbeddingResponse;
    private final List<String> transcriptionRequests = Collections.synchronizedList(new ArrayList<>());
    private volatile String transcription = "{}";
    private volatile boolean transcriptionFailing;

    public OpenAiStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", this::handle);
        server.createContext("/embeddings", this::handleEmbedding);
        server.createContext("/audio/transcriptions", this::handleTranscription);
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public void reply(String json) {
        this.reply = json;
    }

    public void replyRaw(String content) {
        this.rawContent = content;
    }

    public void usage(long promptTokens, long completionTokens) {
        this.usage = ",\"usage\":{\"prompt_tokens\":" + promptTokens + ",\"completion_tokens\":" + completionTokens
                + ",\"total_tokens\":" + (promptTokens + completionTokens) + "}";
    }

    public void finishReason(String reason) {
        this.finishReason = reason;
    }

    public void delay(java.time.Duration delay) {
        this.delayMillis = delay.toMillis();
    }

    public void slowNext(java.time.Duration delay) {
        nextDelayMillis.set(delay.toMillis());
    }

    public void failNext(int status) {
        nextStatuses.add(status);
    }

    public void setFailing(boolean failing) {
        this.failing = failing;
    }

    public List<String> requests() {
        synchronized (requests) {
            return List.copyOf(requests);
        }
    }

    public void replyWhen(String marker, String json) {
        repliesWhen.put(marker, json);
    }

    public void embedWhen(String marker, float... vector) {
        vectorsWhen.put(marker, vector);
    }

    public void defaultVector(float... vector) {
        this.defaultVector = vector;
    }

    public void setEmbeddingsFailing(boolean failing) {
        this.embeddingsFailing = failing;
    }

    public void embeddingResponseRaw(String body) {
        this.rawEmbeddingResponse = body;
    }

    public List<String> embeddingRequests() {
        synchronized (embeddingRequests) {
            return List.copyOf(embeddingRequests);
        }
    }

    public void transcription(String verboseJson) {
        this.transcription = verboseJson;
    }

    public void setTranscriptionFailing(boolean failing) {
        this.transcriptionFailing = failing;
    }

    public List<String> transcriptionRequests() {
        synchronized (transcriptionRequests) {
            return List.copyOf(transcriptionRequests);
        }
    }

    public void reset() {
        transcriptionRequests.clear();
        transcription = "{}";
        transcriptionFailing = false;
        requests.clear();
        reply = "{}";
        rawContent = null;
        delayMillis = 0;
        nextDelayMillis.set(0);
        nextStatuses.clear();
        usage = "";
        finishReason = "stop";
        failing = false;
        repliesWhen.clear();
        embeddingRequests.clear();
        vectorsWhen.clear();
        defaultVector = new float[] {1, 0, 0};
        embeddingsFailing = false;
        rawEmbeddingResponse = null;
    }

    @Override
    public void close() {
        server.stop(0);
    }

    private void handle(HttpExchange ex) throws IOException {
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        requests.add(body);
        Integer status = nextStatuses.poll();
        sleep(Math.max(delayMillis, nextDelayMillis.getAndSet(0)));
        if (failing || status != null) {
            send(ex, status != null ? status : 500, "{\"error\":\"boom\"}");
            return;
        }
        String answer = reply;
        synchronized (repliesWhen) {
            for (var e : repliesWhen.entrySet()) {
                if (body.contains(e.getKey())) {
                    answer = e.getValue();
                    break;
                }
            }
        }
        String content = JsonMapper.builder().build().writeValueAsString(rawContent != null ? rawContent : answer);
        send(ex, 200, "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":" + content + "},\"finish_reason\":\"" + finishReason + "\"}]" + usage + "}");
    }

    private void handleEmbedding(HttpExchange ex) throws IOException {
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        embeddingRequests.add(body);
        pause();
        if (embeddingsFailing) {
            send(ex, 500, "{\"error\":\"boom\"}");
            return;
        }
        if (rawEmbeddingResponse != null) {
            send(ex, 200, rawEmbeddingResponse);
            return;
        }
        float[] vector = defaultVector;
        synchronized (vectorsWhen) {
            for (var e : vectorsWhen.entrySet()) {
                if (body.contains(e.getKey())) {
                    vector = e.getValue();
                    break;
                }
            }
        }
        StringBuilder values = new StringBuilder();
        for (int i = 0; i < vector.length; i++) {
            values.append(i == 0 ? "" : ",").append(vector[i]);
        }
        send(ex, 200, "{\"data\":[{\"embedding\":[" + values + "],\"index\":0}],\"usage\":{\"total_tokens\":12}}");
    }

    private void handleTranscription(HttpExchange ex) throws IOException {
        String contentType = String.valueOf(ex.getRequestHeaders().getFirst("Content-Type"));
        byte[] body = ex.getRequestBody().readAllBytes();
        transcriptionRequests.add(contentType + "\n" + new String(body, StandardCharsets.ISO_8859_1));
        if (transcriptionFailing) {
            send(ex, 500, "{\"error\":\"boom\"}");
            return;
        }
        send(ex, 200, transcription);
    }

    private void pause() {
        sleep(delayMillis);
    }

    private static void sleep(long millis) {
        if (millis > 0) {
            try {
                Thread.sleep(millis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
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
