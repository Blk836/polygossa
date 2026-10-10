package app.lector.text;

import app.lector.common.ApiException;
import java.io.IOException;
import java.net.IDN;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

@Component
public class UrlImporter {

    private final boolean blockPrivateHosts;

    public UrlImporter() {
        this(true);
    }

    UrlImporter(boolean blockPrivateHosts) {
        this.blockPrivateHosts = blockPrivateHosts;
    }

    public record Article(String title, String body, String url) {}

    private static final int MAX_REDIRECTS = 5;
    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final int MIN_ARTICLE_CHARS = 200;
    private static final String USER_AGENT = "Mozilla/5.0 (compatible; LectorReader/1.0; +https://example.com/bot)";

    public Article fetch(String url) {
        Page page = download(parse(url), blockPrivateHosts);
        String body = truncateAtParagraph(extractBody(page.doc()), TextService.MAX_CONTENT_CHARS);
        if (body.isBlank()) {
            throw ApiException.badRequest("Could not find article text on that page; try pasting it instead");
        }
        return new Article(extractTitle(page.doc()), body, page.uri().toString());
    }

    private record Page(Document doc, URI uri) {}

    private static Page download(URI start, boolean blockPrivateHosts) {
        URI uri = start;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            if (blockPrivateHosts) {
                assertPublicHost(uri);
            }
            Connection.Response response = request(uri);
            String location = response.statusCode() / 100 == 3 ? response.header("Location") : null;
            if (location == null) {
                return new Page(parsePage(response), uri);
            }
            uri = parse(uri.resolve(location).toString());
        }
        throw ApiException.badRequest("Too many redirects");
    }

    private static Connection.Response request(URI uri) {
        try {
            return Jsoup.connect(uri.toString())
                    .userAgent(USER_AGENT)
                    .timeout(10_000)
                    .maxBodySize(MAX_BYTES)
                    .followRedirects(false)
                    .ignoreHttpErrors(true)
                    .ignoreContentType(true)
                    .execute();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not fetch that URL: " + e.getMessage());
        }
    }

    private static Document parsePage(Connection.Response response) {
        if (response.statusCode() >= 400) {
            throw ApiException.badRequest("The page returned HTTP " + response.statusCode());
        }
        String type = response.contentType();
        if (type != null && !type.contains("html") && !type.contains("xml")) {
            throw ApiException.badRequest("That URL is not a web page (" + type + ")");
        }
        try {
            return response.parse();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not fetch that URL: " + e.getMessage());
        }
    }

    static String truncateAtParagraph(String body, int max) {
        if (body.length() <= max) {
            return body;
        }
        int cut = body.lastIndexOf("\n\n", max);
        return body.substring(0, cut > 0 ? cut : max);
    }

    static String extractTitle(Document doc) {
        Element og = doc.selectFirst("meta[property=og:title]");
        if (og != null && !og.attr("content").isBlank()) {
            return og.attr("content").trim();
        }
        Element h1 = doc.selectFirst("h1");
        if (h1 != null && !h1.text().isBlank()) {
            return h1.text().trim();
        }
        return doc.title().isBlank() ? "Imported article" : doc.title().trim();
    }

    static String extractBody(Document doc) {
        doc.select("script, style, noscript, nav, header, footer, aside, form, iframe, svg, figure, button").remove();
        List<Element> candidates = new ArrayList<>(doc.select("article, [itemprop=articleBody], main"));
        Element semantic = richest(candidates);
        if (semantic == null || paragraphText(semantic).length() < MIN_ARTICLE_CHARS) {
            for (Element p : doc.select("p")) {
                if (p.parent() != null) {
                    candidates.add(p.parent());
                }
            }
            semantic = richest(candidates);
        }
        Element best = semantic != null ? semantic : doc.body();
        return best == null ? "" : paragraphText(best);
    }

    private static Element richest(List<Element> candidates) {
        Element best = null;
        int bestScore = 0;
        for (Element candidate : candidates) {
            int score = paragraphText(candidate).length();
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        return best;
    }

    private static String paragraphText(Element root) {
        List<String> parts = new ArrayList<>();
        for (Element el : root.select("p, h2, h3, li, blockquote")) {
            if (!el.select("p").isEmpty() && !el.tagName().equals("p")) {
                continue;
            }
            String t = el.text().trim();
            if (t.length() > 1) {
                parts.add(t);
            }
        }
        return String.join("\n\n", parts);
    }

    private static URI parse(String url) {
        try {
            URI uri = new URI(url.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https")) {
                throw ApiException.badRequest("Only http and https URLs can be imported");
            }
            if (uri.getHost() == null) {
                throw ApiException.badRequest("Invalid URL");
            }
            return uri;
        } catch (URISyntaxException e) {
            throw ApiException.badRequest("Invalid URL");
        }
    }

    static void assertPublicHost(URI uri) {
        try {
            for (InetAddress addr : InetAddress.getAllByName(IDN.toASCII(uri.getHost()))) {
                if (addr.isLoopbackAddress() || addr.isAnyLocalAddress() || addr.isLinkLocalAddress()
                        || addr.isSiteLocalAddress() || addr.isMulticastAddress() || isUniqueLocalV6(addr)
                        || isCarrierGradeNat(addr)) {
                    throw ApiException.badRequest("That address cannot be imported");
                }
            }
        } catch (UnknownHostException e) {
            throw ApiException.badRequest("Unknown host: " + uri.getHost());
        }
    }

    private static boolean isUniqueLocalV6(InetAddress addr) {
        return addr instanceof Inet6Address && (addr.getAddress()[0] & 0xfe) == 0xfc;
    }

    private static boolean isCarrierGradeNat(InetAddress addr) {
        byte[] b = addr.getAddress();
        return b.length == 4 && (b[0] & 0xff) == 100 && (b[1] & 0xc0) == 64;
    }
}
