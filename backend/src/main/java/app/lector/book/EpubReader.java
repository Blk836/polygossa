package app.lector.book;

import app.lector.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.jsoup.select.Elements;

final class EpubReader {

    private static final int MAX_ENTRIES = 5_000;
    private static final long MAX_TOTAL_BYTES = 150L * 1024 * 1024;
    private static final String BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, dd, dt";

    private EpubReader() {}

    static Book read(byte[] bytes, String fallbackTitle, int maxChars) {
        Map<String, byte[]> files = unzip(bytes);
        Document container = xml(files.get("META-INF/container.xml"));
        Element rootfile = container.selectFirst("rootfile[full-path]");
        String opfPath = rootfile == null ? null : rootfile.attr("full-path");
        Document opf = xml(files.get(opfPath));
        String base = opfPath.contains("/") ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : "";

        Map<String, String> manifest = new HashMap<>();
        for (Element item : opf.select("manifest > item")) {
            manifest.put(item.attr("id"), base + URLDecoder.decode(item.attr("href"), StandardCharsets.UTF_8));
        }
        List<Book.Chapter> chapters = new ArrayList<>();
        for (Element ref : opf.select("spine > itemref")) {
            byte[] doc = files.get(manifest.get(ref.attr("idref")));
            if (doc != null) {
                chapter(new String(doc, StandardCharsets.UTF_8), chapters.size() + 1)
                        .ifPresent(c -> chapters.addAll(Chapters.split(c.title(), c.content(), maxChars)));
            }
        }
        Element title = opf.selectFirst("dc|title, title");
        String bookTitle = title != null && !title.text().isBlank() ? title.text().strip() : fallbackTitle;
        return new Book(bookTitle, chapters);
    }

    private static Optional<Book.Chapter> chapter(String xhtml, int number) {
        Document doc = Jsoup.parse(xhtml);
        doc.select("script, style").remove();
        Element heading = doc.selectFirst("h1, h2, h3");
        String headingText = heading == null ? "" : heading.text().strip();
        String title = !headingText.isEmpty() ? headingText
                : !doc.title().isBlank() ? doc.title().strip() : "Part " + number;
        List<String> paragraphs = new ArrayList<>();
        for (Element block : innermost(doc.body().select(BLOCKS))) {
            String text = block.text().strip();
            if (!text.isEmpty() && block != heading) {
                paragraphs.add(text);
            }
        }
        String content = paragraphs.isEmpty() ? doc.body().text().strip() : String.join("\n\n", paragraphs);
        return content.isEmpty() || content.equals(headingText) ? Optional.empty()
                : Optional.of(new Book.Chapter(title, content));
    }

    private static List<Element> innermost(Elements blocks) {
        return blocks.stream().filter(b -> b.select(BLOCKS).size() == 1).toList();
    }

    private static Document xml(byte[] bytes) {
        if (bytes == null) {
            throw unreadable();
        }
        return Jsoup.parse(new String(bytes, StandardCharsets.UTF_8), "", Parser.xmlParser());
    }

    private static Map<String, byte[]> unzip(byte[] bytes) {
        Map<String, byte[]> files = new HashMap<>();
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            for (ZipEntry e = zip.getNextEntry(); e != null; e = zip.getNextEntry()) {
                if (files.size() >= MAX_ENTRIES) {
                    throw unreadable();
                }
                byte[] data = readCapped(zip, MAX_TOTAL_BYTES - total);
                total += data.length;
                files.put(e.getName(), data);
            }
        } catch (IOException | IllegalArgumentException e) {
            throw unreadable();
        }
        return files;
    }

    private static byte[] readCapped(InputStream in, long budget) throws IOException {
        byte[] data = in.readNBytes((int) Math.min(budget + 1, Integer.MAX_VALUE - 8));
        if (data.length > budget) {
            throw unreadable();
        }
        return data;
    }

    static ApiException unreadable() {
        return ApiException.badRequest("This EPUB could not be read. Is it protected by DRM or damaged?");
    }
}
