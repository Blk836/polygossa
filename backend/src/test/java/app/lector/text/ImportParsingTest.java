package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.common.ApiException;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;

/** Characterization tests for subtitle and article parsing edge cases. */
class ImportParsingTest {

    @Test
    void subtitleCueEndsAtANewTimingLineEvenWithoutABlankLine() {
        var parsed = SubtitleParser.parse("""
                00:00:01,000 --> 00:00:02,000
                Uno
                00:00:03,000 --> 00:00:04,000
                Dos
                """);
        assertThat(parsed.cues()).extracting(SubtitleParser.Cue::text).containsExactly("Uno", "Dos");
        assertThat(parsed.cues().get(1).startMs()).isEqualTo(3000);
    }

    @Test
    void subtitleCuesWithOnlyTagsAreDropped() {
        var parsed = SubtitleParser.parse("""
                1
                00:00:01,000 --> 00:00:02,000
                <i></i>

                2
                00:00:03,000 --> 00:00:04,000
                {\\an8}Hola <b>amigo</b>
                """);
        assertThat(parsed.content()).isEqualTo("Hola amigo");
        assertThat(parsed.cues()).hasSize(1);
        assertThat(parsed.cues().getFirst().charStart()).isZero();
    }

    @Test
    void subtitleTimestampsAcceptHoursAndShortFractions() {
        assertThat(SubtitleParser.toMillis("01:02:03,4")).isEqualTo(3_723_400);
        assertThat(SubtitleParser.toMillis("02:03.45")).isEqualTo(123_450);
        assertThat(SubtitleParser.toMillis("00:00:01")).isEqualTo(1000);
    }

    @Test
    void articleFallsBackToTheParentWithTheMostParagraphText() {
        var doc = Jsoup.parse("""
                <html><head><title>Página</title></head><body>
                <div class="sidebar"><p>Corto.</p></div>
                <div class="content"><p>Un párrafo bastante largo con mucho texto para leer.</p>
                <p>Otro párrafo más.</p></div></body></html>""");
        assertThat(UrlImporter.extractTitle(doc)).isEqualTo("Página");
        assertThat(UrlImporter.extractBody(doc))
                .isEqualTo("Un párrafo bastante largo con mucho texto para leer.\n\nOtro párrafo más.");
    }

    @Test
    void articleTitleFallsBackToH1ThenDefault() {
        assertThat(UrlImporter.extractTitle(Jsoup.parse("<h1> Titular </h1>"))).isEqualTo("Titular");
        assertThat(UrlImporter.extractTitle(Jsoup.parse("<p>x</p>"))).isEqualTo("Imported article");
    }

    @Test
    void articleListItemsAndQuotesAreKeptButNestedParagraphsAreNotDuplicated() {
        var doc = Jsoup.parse("""
                <article><p>Intro con suficiente texto para ser el mejor candidato.</p>
                <blockquote><p>Cita dentro.</p></blockquote><ul><li>Elemento</li></ul></article>""");
        assertThat(UrlImporter.extractBody(doc))
                .isEqualTo("Intro con suficiente texto para ser el mejor candidato.\n\nCita dentro.\n\nElemento");
    }

    @Test
    void emptyPagesYieldNoBody() {
        assertThat(UrlImporter.extractBody(Jsoup.parse("<html><body><nav><p>Menú</p></nav></body></html>"))).isEmpty();
    }

    private static String paragraphOf(int chars) {
        return "x".repeat(chars);
    }

    @Test
    void aSemanticWrapperWithAtLeast200CharactersIsTheArticle() {
        var doc = Jsoup.parse("<article><p>" + paragraphOf(200) + "</p></article><div><p>" + paragraphOf(400)
                + "</p></div>");
        assertThat(UrlImporter.extractBody(doc)).hasSize(200);
    }

    @Test
    void aSemanticWrapperUnder200CharactersLosesToARicherParagraphContainer() {
        var doc = Jsoup.parse("<main><p>" + paragraphOf(199) + "</p></main><div><p>" + paragraphOf(400) + "</p></div>");
        assertThat(UrlImporter.extractBody(doc)).hasSize(400);
    }

    @Test
    void theFirstOfEquallyRichContainersWins() {
        var doc = Jsoup.parse("<div><p>Aaaa.</p></div><section><p>Bbbb.</p></section>");
        assertThat(UrlImporter.extractBody(doc)).isEqualTo("Aaaa.");
    }

    @Test
    void singleCharacterFragmentsAreDropped() {
        var doc = Jsoup.parse("<article><p>Texto.</p><ul><li>a</li><li>ab</li></ul></article>");
        assertThat(UrlImporter.extractBody(doc)).isEqualTo("Texto.\n\nab");
    }

    @Test
    void aBlankOpenGraphTitleFallsBackToTheHeading() {
        var doc = Jsoup.parse("<meta property=\"og:title\" content=\" \"><h1>Real</h1>");
        assertThat(UrlImporter.extractTitle(doc)).isEqualTo("Real");
    }

    @Test
    void truncationEdges() {
        assertThat(UrlImporter.truncateAtParagraph("abcde", 5)).isEqualTo("abcde");
        assertThat(UrlImporter.truncateAtParagraph("ab\n\ncd", 6)).as("fits exactly: kept whole").isEqualTo("ab\n\ncd");
        assertThat(UrlImporter.truncateAtParagraph("abcdef", 5)).isEqualTo("abcde");
        assertThat(UrlImporter.truncateAtParagraph("\n\nabcdef", 5)).isEqualTo("\n\nabc");
    }

    @Test
    void onlyHttpUrlsCanBeImported() {
        var importer = new UrlImporter();
        assertThatThrownBy(() -> importer.fetch("ftp://example.com/x")).isInstanceOf(ApiException.class)
                .hasMessageContaining("Only http and https");
        assertThatThrownBy(() -> importer.fetch("not a url")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> importer.fetch("http://127.0.0.1/")).hasMessageContaining("cannot be imported");
    }
}
