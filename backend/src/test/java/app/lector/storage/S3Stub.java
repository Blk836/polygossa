package app.lector.storage;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class S3Stub implements AutoCloseable {

    private static final Pattern RANGE = Pattern.compile("bytes=(\\d+)-(\\d*)");

    private final HttpServer server;
    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();
    private final Map<String, String> types = new ConcurrentHashMap<>();
    private final List<String> requests = Collections.synchronizedList(new ArrayList<>());
    private volatile boolean failing;

    public S3Stub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
    }

    public String endpoint() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public void reset() {
        objects.clear();
        types.clear();
        requests.clear();
        failing = false;
    }

    public void fail(boolean failing) {
        this.failing = failing;
    }

    public Map<String, byte[]> objects() {
        return objects;
    }

    public String contentType(String bucketAndKey) {
        return types.get(bucketAndKey);
    }

    public List<String> requests() {
        return List.copyOf(requests);
    }

    public void put(String bucketAndKey, byte[] bytes) {
        objects.put(bucketAndKey, bytes);
    }

    private void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath().substring(1);
        String method = exchange.getRequestMethod();
        requests.add(method + " /" + path);
        try (exchange) {
            if (failing) {
                error(exchange, 500, "InternalError");
                return;
            }
            switch (method) {
                case "PUT" -> {
                    objects.put(path, body(exchange));
                    String type = exchange.getRequestHeaders().getFirst("Content-Type");
                    if (type != null) {
                        types.put(path, type);
                    }
                    exchange.getResponseHeaders().set("ETag", "\"stub\"");
                    exchange.sendResponseHeaders(200, -1);
                }
                case "GET" -> get(exchange, path);
                case "DELETE" -> {
                    objects.remove(path);
                    exchange.sendResponseHeaders(204, -1);
                }
                default -> error(exchange, 405, "MethodNotAllowed");
            }
        }
    }

    private void get(HttpExchange exchange, String path) throws IOException {
        byte[] object = objects.get(path);
        if (object == null) {
            error(exchange, 404, "NoSuchKey");
            return;
        }
        String type = types.getOrDefault(path, "application/octet-stream");
        exchange.getResponseHeaders().set("Content-Type", type);
        exchange.getResponseHeaders().set("Accept-Ranges", "bytes");
        String range = exchange.getRequestHeaders().getFirst("Range");
        Matcher m = range == null ? null : RANGE.matcher(range);
        if (m == null || !m.matches()) {
            exchange.sendResponseHeaders(200, object.length);
            exchange.getResponseBody().write(object);
            return;
        }
        int start = Integer.parseInt(m.group(1));
        int end = m.group(2).isEmpty() ? object.length - 1 : Math.min(Integer.parseInt(m.group(2)), object.length - 1);
        if (start >= object.length) {
            exchange.getResponseHeaders().set("Content-Range", "bytes */" + object.length);
            error(exchange, 416, "InvalidRange");
            return;
        }
        exchange.getResponseHeaders().set("Content-Range", "bytes " + start + "-" + end + "/" + object.length);
        exchange.sendResponseHeaders(206, end - start + 1L);
        exchange.getResponseBody().write(object, start, end - start + 1);
    }

    private static void error(HttpExchange exchange, int status, String code) throws IOException {
        byte[] xml = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>" + code + "</Code><Message>" + code
                + "</Message></Error>").getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/xml");
        exchange.sendResponseHeaders(status, xml.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(xml);
        }
    }

    private static byte[] body(HttpExchange exchange) throws IOException {
        byte[] raw;
        try (InputStream in = exchange.getRequestBody()) {
            raw = in.readAllBytes();
        }
        String encoding = exchange.getRequestHeaders().getFirst("Content-Encoding");
        String sha = exchange.getRequestHeaders().getFirst("x-amz-content-sha256");
        boolean chunked = (encoding != null && encoding.contains("aws-chunked"))
                || (sha != null && sha.startsWith("STREAMING-"));
        return chunked ? dechunk(raw) : raw;
    }

    static byte[] dechunk(byte[] raw) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int pos = 0;
        while (pos < raw.length) {
            int lineEnd = indexOfCrlf(raw, pos);
            String header = new String(raw, pos, lineEnd - pos, StandardCharsets.US_ASCII);
            int size = Integer.parseInt(header.split(";", 2)[0].trim(), 16);
            if (size == 0) {
                break;
            }
            out.write(raw, lineEnd + 2, size);
            pos = lineEnd + 2 + size + 2;
        }
        return out.toByteArray();
    }

    private static int indexOfCrlf(byte[] raw, int from) {
        for (int i = from; i < raw.length - 1; i++) {
            if (raw[i] == '\r' && raw[i + 1] == '\n') {
                return i;
            }
        }
        return raw.length;
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
