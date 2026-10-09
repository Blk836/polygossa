package app.lector.book;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitDestination;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;

public final class BookFiles {

    private BookFiles() {}

    public static String chapter(String heading, String... paragraphs) {
        StringBuilder body = new StringBuilder();
        if (heading != null) {
            body.append("<h1>").append(heading).append("</h1>");
        }
        for (String p : paragraphs) {
            body.append("<p>").append(p).append("</p>");
        }
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?><html xmlns=\"http://www.w3.org/1999/xhtml\"><head>"
                + "<title>Doc title</title><style>p { color: red }</style><script>var x = 1;</script></head>"
                + "<body>" + body + "</body></html>";
    }

    public static byte[] epub(String title, Map<String, String> chapters) {
        StringBuilder manifest = new StringBuilder();
        StringBuilder spine = new StringBuilder();
        int i = 0;
        for (String file : chapters.keySet()) {
            manifest.append("<item id=\"c").append(i).append("\" href=\"text/").append(file)
                    .append("\" media-type=\"application/xhtml+xml\"/>");
            spine.append("<itemref idref=\"c").append(i).append("\"/>");
            i++;
        }
        String opf = "<?xml version=\"1.0\"?><package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">"
                + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>" + title + "</dc:title></metadata>"
                + "<manifest>" + manifest + "</manifest><spine>" + spine + "</spine></package>";
        Map<String, String> files = new LinkedHashMap<>();
        files.put("mimetype", "application/epub+zip");
        files.put("META-INF/container.xml", "<?xml version=\"1.0\"?><container version=\"1.0\" "
                + "xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles>"
                + "<rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>"
                + "</rootfiles></container>");
        files.put("OEBPS/content.opf", opf);
        chapters.forEach((file, xhtml) -> files.put("OEBPS/text/" + file, xhtml));
        return zip(files);
    }

    public static byte[] zip(Map<String, String> files) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (var e : files.entrySet()) {
                zip.putNextEntry(new ZipEntry(e.getKey()));
                zip.write(e.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toByteArray();
    }

    public static byte[] pdf(String title, List<List<String>> pages, Map<String, Integer> outline) {
        try (PDDocument doc = new PDDocument()) {
            PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            for (List<String> lines : pages) {
                PDPage page = new PDPage();
                doc.addPage(page);
                try (PDPageContentStream content = new PDPageContentStream(doc, page)) {
                    float y = 740;
                    for (String line : lines) {
                        if (!line.isEmpty()) {
                            content.beginText();
                            content.setFont(font, 11);
                            content.newLineAtOffset(50, y);
                            content.showText(line);
                            content.endText();
                        }
                        y -= line.isEmpty() ? 24 : 14;
                    }
                }
            }
            if (title != null) {
                PDDocumentInformation info = new PDDocumentInformation();
                info.setTitle(title);
                doc.setDocumentInformation(info);
            }
            if (!outline.isEmpty()) {
                PDDocumentOutline root = new PDDocumentOutline();
                outline.forEach((name, index) -> {
                    PDOutlineItem item = new PDOutlineItem();
                    item.setTitle(name);
                    PDPageFitDestination dest = new PDPageFitDestination();
                    dest.setPage(doc.getPage(index));
                    item.setDestination(dest);
                    root.addLast(item);
                });
                doc.getDocumentCatalog().setDocumentOutline(root);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
