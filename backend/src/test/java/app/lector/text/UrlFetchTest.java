package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatNoException;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class UrlFetchTest {

    private static final String ARTICLE = "<html><head><meta property=\"og:title\" content=\"Noticia\"></head><body>"
            + "<article><p>" + "Texto del artículo. ".repeat(20) + "</p></article></body></html>";

    private static final java.util.Map<String, String[]> FIXED = java.util.Map.of(
            "/article", new String[] {"200", "text/html; charset=utf-8", ARTICLE},
            "/xhtml", new String[] {"200", "application/xhtml+xml", ARTICLE},
            "/missing", new String[] {"404", "text/html", "<p>nope</p>"},
            "/teapot", new String[] {"400", "text/html", "<p>bad</p>"},
            "/pdf", new String[] {"200", "application/pdf", "%PDF"},
            "/plain", new String[] {"200", "text/plain", "Solo texto."},
            "/empty", new String[] {"200", "text/html", "<html><body><nav>menu</nav></body></html>"},
            "/redirect-no-location", new String[] {"302", "text/html", ARTICLE});

    private static HttpServer server;
    private static String base;
    private static final UrlImporter importer = new UrlImporter(false);

    @BeforeAll
    static void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", UrlFetchTest::handle);
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterAll
    static void stop() {
        server.stop(0);
    }

    private static void handle(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        if (path.startsWith("/r/")) {
            int n = Integer.parseInt(path.substring(3));
            if (n > 0) {
                ex.getResponseHeaders().add("Location", "/r/" + (n - 1));
                ex.sendResponseHeaders(302, -1);
                ex.close();
                return;
            }
            send(ex, 200, "text/html; charset=utf-8", ARTICLE);
            return;
        }
        String[] fixed = FIXED.getOrDefault(path, new String[] {"500", "text/plain", "?"});
        send(ex, Integer.parseInt(fixed[0]), fixed[1], fixed[2]);
    }

    private static void send(HttpExchange ex, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", type);
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    @Test
    void importsAnArticle() {
        UrlImporter.Article a = importer.fetch(base + "/article");
        assertThat(a.title()).isEqualTo("Noticia");
        assertThat(a.body()).startsWith("Texto del artículo.");
        assertThat(a.url()).isEqualTo(base + "/article");
    }

    @Test
    void acceptsXmlContentTypes() {
        assertThat(importer.fetch(base + "/xhtml").title()).isEqualTo("Noticia");
    }

    @Test
    void followsUpToFiveRedirectsAndReportsTheFinalUrl() {
        assertThat(importer.fetch(base + "/r/5").url()).isEqualTo(base + "/r/0");
        assertThatThrownBy(() -> importer.fetch(base + "/r/6")).hasMessage("Too many redirects");
    }

    @Test
    void aRedirectWithoutLocationIsTreatedAsThePage() {
        assertThat(importer.fetch(base + "/redirect-no-location").title()).isEqualTo("Noticia");
    }

    @Test
    void reportsHttpErrors() {
        assertThatThrownBy(() -> importer.fetch(base + "/missing")).hasMessage("The page returned HTTP 404");
        assertThatThrownBy(() -> importer.fetch(base + "/teapot")).hasMessage("The page returned HTTP 400");
    }

    @Test
    void rejectsNonPages() {
        assertThatThrownBy(() -> importer.fetch(base + "/pdf"))
                .hasMessage("That URL is not a web page (application/pdf)");
        assertThatThrownBy(() -> importer.fetch(base + "/plain")).hasMessage("That URL is not a web page (text/plain)");
    }

    @Test
    void rejectsPagesWithoutArticleText() {
        assertThatThrownBy(() -> importer.fetch(base + "/empty")).hasMessageContaining("Could not find article text");
    }

    @Test
    void reportsUnreachableHosts() {
        assertThatThrownBy(() -> importer.fetch("http://127.0.0.1:1/x")).hasMessageStartingWith("Could not fetch that URL");
    }

    @Test
    void productionImporterBlocksTheStubServer() {
        assertThatThrownBy(() -> new UrlImporter().fetch(base + "/article")).hasMessageContaining("cannot be imported");
    }

    @Test
    void blocksUniqueLocalAndCarrierGradeNatButNotPublicAddresses() {
        for (String url : new String[] {"http://[fd00::1]/", "http://[fc00::1]/", "http://100.64.0.1/",
                "http://100.127.255.254/", "http://172.16.0.1/", "http://[fe80::1]/", "http://224.0.0.1/",
                "http://0.0.0.0/"}) {
            assertThatThrownBy(() -> UrlImporter.assertPublicHost(URI.create(url))).as(url)
                    .hasMessageContaining("cannot be imported");
        }
        for (String url : new String[] {"http://8.8.8.8/", "http://100.128.0.1/", "http://100.63.255.255/",
                "http://[2001:4860:4860::8888]/", "http://[fe00::1]/"}) {
            assertThatNoException().as(url).isThrownBy(() -> UrlImporter.assertPublicHost(URI.create(url)));
        }
    }
}
