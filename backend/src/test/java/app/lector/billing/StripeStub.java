package app.lector.billing;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class StripeStub implements AutoCloseable {

    public static final String WEBHOOK_SECRET = "whsec_test_secret";

    public record Call(String method, String path, Map<String, String> form) {}

    private final HttpServer server;
    private final List<Call> calls = Collections.synchronizedList(new ArrayList<>());
    private final Map<String, String> subscriptions = new ConcurrentHashMap<>();
    private final AtomicInteger customers = new AtomicInteger();
    private volatile boolean failing;

    public StripeStub() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
    }

    public String apiBase() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    public void reset() {
        calls.clear();
        subscriptions.clear();
        failing = false;
    }

    public void fail(boolean failing) {
        this.failing = failing;
    }

    public List<Call> calls() {
        return List.copyOf(calls);
    }

    public List<Call> calls(String method, String pathStart) {
        return calls().stream().filter(c -> c.method().equals(method) && c.path().startsWith(pathStart)).toList();
    }

    public void subscription(String id, String customer, String status, String lookupKey, String interval,
                             long periodEnd, boolean cancelAtPeriodEnd, long quantity) {
        subscriptions.put(id, """
                {"id":"%s","object":"subscription","customer":"%s","status":"%s","cancel_at_period_end":%s,
                 "items":{"object":"list","has_more":false,"data":[{"id":"si_%s","object":"subscription_item",
                 "quantity":%d,"current_period_end":%d,
                 "price":{"id":"price_%s","object":"price","lookup_key":"%s","recurring":{"interval":"%s"}}}]}}
                """.formatted(id, customer, status, cancelAtPeriodEnd, id, quantity, periodEnd, lookupKey, lookupKey,
                interval));
    }

    public static String event(String eventId, String type, String subscriptionId, String customer) {
        return """
                {"id":"%s","object":"event","type":"%s","api_version":"2026-09-30.endive","created":%d,
                 "data":{"object":{"id":"%s","object":"subscription","customer":"%s"}}}
                """.formatted(eventId, type, System.currentTimeMillis() / 1000, subscriptionId, customer);
    }

    public static String signature(String payload, String secret) {
        long t = System.currentTimeMillis() / 1000;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return "t=" + t + ",v1=" + hex;
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        String query = exchange.getRequestURI().getRawQuery();
        Map<String, String> form = parse(query);
        try (InputStream in = exchange.getRequestBody()) {
            form.putAll(parse(new String(in.readAllBytes(), StandardCharsets.UTF_8)));
        }
        calls.add(new Call(method, path, form));
        try (exchange) {
            if (failing) {
                respond(exchange, 500, "{\"error\":{\"type\":\"api_error\",\"message\":\"Stripe is down\"}}");
                return;
            }
            route(exchange, method, path, form);
        }
    }

    private void route(HttpExchange exchange, String method, String path, Map<String, String> form) throws IOException {
        if (method.equals("GET") && path.equals("/v1/prices")) {
            List<String> data = new ArrayList<>();
            form.forEach((k, v) -> {
                if (k.startsWith("lookup_keys")) {
                    data.add("{\"id\":\"price_" + v + "\",\"object\":\"price\",\"lookup_key\":\"" + v + "\"}");
                }
            });
            respond(exchange, 200, "{\"object\":\"list\",\"has_more\":false,\"data\":[" + String.join(",", data) + "]}");
        } else if (method.equals("POST") && path.equals("/v1/customers")) {
            respond(exchange, 200, "{\"id\":\"cus_" + customers.incrementAndGet() + "\",\"object\":\"customer\"}");
        } else if (method.equals("POST") && path.equals("/v1/checkout/sessions")) {
            respond(exchange, 200, "{\"id\":\"cs_1\",\"object\":\"checkout.session\",\"url\":\"https://checkout.stripe.test/cs_1\"}");
        } else if (method.equals("POST") && path.equals("/v1/billing_portal/sessions")) {
            respond(exchange, 200, "{\"id\":\"bps_1\",\"object\":\"billing_portal.session\",\"url\":\"https://billing.stripe.test/p_1\"}");
        } else if (path.startsWith("/v1/subscriptions/") && subscriptions.containsKey(path.substring(18))) {
            String id = path.substring(18);
            if (method.equals("DELETE")) {
                subscriptions.put(id, subscriptions.get(id).replaceFirst("\"status\":\"[a-z_]+\"", "\"status\":\"canceled\""));
            }
            respond(exchange, 200, subscriptions.get(id));
        } else if (method.equals("POST") && path.startsWith("/v1/subscription_items/")) {
            respond(exchange, 200, "{\"id\":\"" + path.substring(23) + "\",\"object\":\"subscription_item\",\"quantity\":"
                    + form.getOrDefault("quantity", "1") + "}");
        } else {
            respond(exchange, 404, "{\"error\":{\"type\":\"invalid_request_error\",\"message\":\"No such resource\"}}");
        }
    }

    private static Map<String, String> parse(String encoded) {
        Map<String, String> fields = new LinkedHashMap<>();
        if (encoded == null || encoded.isBlank()) {
            return fields;
        }
        for (String pair : encoded.split("&")) {
            String[] kv = pair.split("=", 2);
            fields.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
                    kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "");
        }
        return fields;
    }

    private static void respond(HttpExchange exchange, int status, String json) throws IOException {
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
