package app.lector.book;

import static app.lector.book.BookFiles.chapter;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.common.ApiException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class BookReaderTest {

    private static Book read(byte[] bytes, String fileName) {
        return BookReader.read(bytes, fileName);
    }

    @Test
    void anEpubBecomesItsChaptersInSpineOrder() {
        Map<String, String> chapters = new LinkedHashMap<>();
        chapters.put("cover.xhtml", "<html><body><img src=\"cover.jpg\"/></body></html>");
        chapters.put("b.xhtml", chapter("Uno", "Primer párrafo.", "Segundo párrafo."));
        chapters.put("a.xhtml", chapter("Dos", "Otro capítulo."));
        Book book = read(BookFiles.epub("El viaje", chapters), "viaje.epub");
        assertThat(book.title()).isEqualTo("El viaje");
        assertThat(book.chapters()).extracting(Book.Chapter::title).containsExactly("Uno", "Dos");
        assertThat(book.chapters().getFirst().content()).isEqualTo("Primer párrafo.\n\nSegundo párrafo.");
    }

    @Test
    void chapterTitlesFallBackToTheDocumentTitleThenPartN() {
        Map<String, String> chapters = new LinkedHashMap<>();
        chapters.put("a.xhtml", chapter(null, "Texto sin encabezado."));
        chapters.put("b.xhtml", "<html><body><p>Ni título ni encabezado.</p></body></html>");
        Book book = read(BookFiles.epub("Libro", chapters), "libro.epub");
        assertThat(book.chapters()).extracting(Book.Chapter::title).containsExactly("Doc title", "Part 2");
    }

    @Test
    void scriptStyleAndMarkupAreNotText() {
        Book book = read(BookFiles.epub("Libro", Map.of("a.xhtml", chapter("T", "Hola <b>mundo</b> & más."))),
                "x.epub");
        String content = book.chapters().getFirst().content();
        assertThat(content).isEqualTo("Hola mundo & más.");
        assertThat(content).doesNotContain("var x").doesNotContain("color");
    }

    @Test
    void aVeryLongChapterIsSplitAtParagraphs() {
        String paragraph = "palabra ".repeat(1249).strip() + ".";
        String[] paragraphs = new String[25];
        java.util.Arrays.fill(paragraphs, paragraph);
        Book book = read(BookFiles.epub("Largo", Map.of("a.xhtml", chapter("Largo", paragraphs))), "x.epub");
        assertThat(book.chapters()).extracting(Book.Chapter::title).containsExactly("Largo (1)", "Largo (2)", "Largo (3)");
        assertThat(book.chapters()).allSatisfy(c -> {
            assertThat(c.content().length()).isLessThanOrEqualTo(100_000);
            assertThat(c.content()).endsWith(".");
            assertThat(c.content()).startsWith("palabra");
        });
    }

    @Test
    void aBrokenEpubIsRefused() {
        byte[] noContainer = BookFiles.zip(Map.of("mimetype", "application/epub+zip", "x.xhtml", "<p>x</p>"));
        assertThatThrownBy(() -> read(noContainer, "broken.epub")).isInstanceOf(ApiException.class)
                .hasMessageContaining("This EPUB could not be read");
    }

    @Test
    void tooManyChaptersAreRefused() {
        Map<String, String> chapters = new LinkedHashMap<>();
        for (int i = 0; i < 301; i++) {
            chapters.put("c" + i + ".xhtml", chapter("C" + i, "Texto " + i + "."));
        }
        assertThatThrownBy(() -> read(BookFiles.epub("Enorme", chapters), "x.epub")).isInstanceOf(ApiException.class)
                .hasMessageContaining("at most 300 chapters");
    }

    @Test
    void threeHundredChaptersAreAllowed() {
        Map<String, String> chapters = new LinkedHashMap<>();
        for (int i = 0; i < 300; i++) {
            chapters.put("c" + i + ".xhtml", chapter("C" + i, "Texto " + i + "."));
        }
        assertThat(read(BookFiles.epub("Grande", chapters), "x.epub").chapters()).hasSize(300);
    }

    @Test
    void otherFilesAreRefused() {
        assertThatThrownBy(() -> read("just some text".getBytes(), "notes.txt")).isInstanceOf(ApiException.class)
                .hasMessageContaining("Upload an EPUB or a PDF");
        assertThatThrownBy(() -> read("P".getBytes(), "p.pdf")).isInstanceOf(ApiException.class)
                .hasMessageContaining("Upload an EPUB or a PDF");
        assertThatThrownBy(() -> read("PX not a zip".getBytes(), "x.epub")).isInstanceOf(ApiException.class)
                .hasMessageContaining("Upload an EPUB or a PDF");
    }

    @Test
    void aPdfWithAnOutlineIsSplitAtItsChapters() {
        byte[] pdf = BookFiles.pdf("Mi libro", List.of(
                List.of("Primera pagina del capitulo uno."), List.of("Segunda pagina del capitulo uno."),
                List.of("El capitulo dos empieza aqui.")),
                outline());
        Book book = read(pdf, "libro.pdf");
        assertThat(book.title()).isEqualTo("Mi libro");
        assertThat(book.chapters()).extracting(Book.Chapter::title).containsExactly("Capitulo 1", "Capitulo 2");
        assertThat(book.chapters().getFirst().content()).contains("Primera pagina").contains("Segunda pagina")
                .doesNotContain("capitulo dos");
        assertThat(book.chapters().get(1).content()).isEqualTo("El capitulo dos empieza aqui.");
    }

    private static Map<String, Integer> outline() {
        Map<String, Integer> outline = new LinkedHashMap<>();
        outline.put("Capitulo 1", 0);
        outline.put("Capitulo 2", 2);
        return outline;
    }

    @Test
    void aPdfWithoutAnOutlineIsCutIntoParts() {
        List<List<String>> pages = new ArrayList<>();
        for (int p = 0; p < 30; p++) {
            List<String> lines = new ArrayList<>();
            for (int l = 0; l < 40; l++) {
                lines.add("Linea " + l + " de la pagina " + p + " con algunas palabras mas.");
            }
            pages.add(lines);
        }
        Book book = read(BookFiles.pdf(null, pages, Map.of()), "apuntes.pdf");
        assertThat(book.title()).isEqualTo("apuntes");
        assertThat(book.chapters().size()).isGreaterThan(1);
        assertThat(book.chapters().getFirst().title()).isEqualTo("Part 1");
        assertThat(book.chapters()).allSatisfy(c -> assertThat(c.content().length()).isLessThanOrEqualTo(25_000));
        assertThat(book.chapters().getFirst().content()).doesNotContainPattern("[^\n]\n[^\n]")
                .contains("mas.\n\nLinea 0 de la pagina 1");
    }

    @Test
    void aPdfWithoutTextIsRefused() {
        byte[] blank = BookFiles.pdf("Escaneado", List.of(List.of(), List.of()), Map.of());
        assertThatThrownBy(() -> read(blank, "scan.pdf")).isInstanceOf(ApiException.class)
                .hasMessageContaining("This PDF has no text to read");
    }
}
