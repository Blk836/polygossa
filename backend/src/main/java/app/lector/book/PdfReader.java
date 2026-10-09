package app.lector.book;

import app.lector.common.ApiException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import org.apache.pdfbox.text.PDFTextStripper;

final class PdfReader {

    static final int PART_CHARS = 20_000;
    private static final String PARAGRAPH = " ";

    private PdfReader() {}

    static Book read(byte[] bytes, String fallbackTitle, int maxChars) {
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            String title = doc.getDocumentInformation().getTitle();
            String bookTitle = title != null && !title.isBlank() ? title.strip() : fallbackTitle;
            TreeMap<Integer, String> starts = outline(doc);
            List<Book.Chapter> chapters = starts.isEmpty() ? parts(text(doc, 1, doc.getNumberOfPages()))
                    : byOutline(doc, starts, maxChars);
            if (chapters.isEmpty()) {
                throw ApiException.badRequest("This PDF has no text to read (scanned pages need OCR first)");
            }
            return new Book(bookTitle, chapters);
        } catch (IOException e) {
            throw ApiException.badRequest("This PDF could not be read. Is it password-protected or damaged?");
        }
    }

    private static TreeMap<Integer, String> outline(PDDocument doc) throws IOException {
        TreeMap<Integer, String> starts = new TreeMap<>();
        PDDocumentOutline outline = doc.getDocumentCatalog().getDocumentOutline();
        if (outline == null) {
            return starts;
        }
        for (PDOutlineItem item : outline.children()) {
            PDPage page = item.findDestinationPage(doc);
            int index = page == null ? -1 : doc.getPages().indexOf(page);
            if (index >= 0 && item.getTitle() != null && !item.getTitle().isBlank()) {
                starts.putIfAbsent(index, item.getTitle().strip());
            }
        }
        return starts;
    }

    private static List<Book.Chapter> byOutline(PDDocument doc, TreeMap<Integer, String> starts, int maxChars)
            throws IOException {
        List<Book.Chapter> chapters = new ArrayList<>();
        if (starts.firstKey() > 0) {
            starts.put(0, "Front matter");
        }
        List<Integer> pages = new ArrayList<>(starts.keySet());
        for (int i = 0; i < pages.size(); i++) {
            int last = i + 1 < pages.size() ? pages.get(i + 1) : doc.getNumberOfPages();
            String content = text(doc, pages.get(i) + 1, last);
            if (!content.isEmpty()) {
                chapters.addAll(Chapters.split(starts.get(pages.get(i)), content, maxChars));
            }
        }
        return chapters;
    }

    private static List<Book.Chapter> parts(String content) {
        if (content.isEmpty()) {
            return List.of();
        }
        List<String> parts = Chapters.pack(content, PART_CHARS);
        List<Book.Chapter> out = new ArrayList<>();
        for (int i = 0; i < parts.size(); i++) {
            out.add(new Book.Chapter("Part " + (i + 1), parts.get(i)));
        }
        return out;
    }

    private static String text(PDDocument doc, int first, int last) throws IOException {
        PDFTextStripper stripper = new PDFTextStripper();
        stripper.setSortByPosition(true);
        stripper.setStartPage(first);
        stripper.setEndPage(last);
        stripper.setLineSeparator("\n");
        stripper.setParagraphEnd(PARAGRAPH);
        stripper.setPageEnd(PARAGRAPH);
        String raw = stripper.getText(doc);
        List<String> paragraphs = new ArrayList<>();
        for (String paragraph : raw.split(PARAGRAPH)) {
            String joined = paragraph.replaceAll("(\\p{L})-\\n(\\p{Ll})", "$1$2").replaceAll("\\s*\\n\\s*", " ").strip();
            if (!joined.isEmpty()) {
                paragraphs.add(joined);
            }
        }
        return String.join("\n\n", paragraphs);
    }
}
