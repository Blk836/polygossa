package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.config.AppProperties;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import app.lector.vocab.WordStatus;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class TextProcessingTest {

    private static List<Token> tokens(Language language, String text) {
        var props = new AppProperties(null, new AppProperties.Tokenizer("", null), null, null, null, null, List.of(), false, false);
        return new TokenizationService(props, RestClient.builder()).tokenize(language, text);
    }

    @Test
    void parsesSrtAndVtt() {
        var srt = SubtitleParser.parse("1\r\n00:00:01,500 --> 00:00:03,000\r\n<i>Hola</i>\r\namigo\r\n\r\n"
                + "2\r\n00:01:02,000 --> 00:01:04,250\r\n¿Qué tal?\r\n");
        assertThat(srt.content()).isEqualTo("Hola amigo\n¿Qué tal?");
        assertThat(srt.cues()).hasSize(2);
        assertThat(srt.cues().get(1).startMs()).isEqualTo(62_000);
        assertThat(srt.cues().get(1).endMs()).isEqualTo(64_250);
        assertThat(srt.cues().get(1).charStart()).isEqualTo(11);

        var vtt = SubtitleParser.parse("WEBVTT\n\n00:05.000 --> 00:07.5\nBonjour\n");
        assertThat(vtt.cues().getFirst().startMs()).isEqualTo(5_000);
        assertThat(vtt.cues().getFirst().endMs()).isEqualTo(7_500);

        assertThatThrownBy(() -> SubtitleParser.parse("just text")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void estimatesHarderLevelForDenserText() {
        String easy = "Yo tengo un gato. El gato es negro. Yo tengo un perro. El perro es blanco. "
                + "El gato y el perro son amigos. Yo soy feliz.";
        String hard = "La consolidación institucional del parlamentarismo decimonónico, caracterizada por "
                + "alternancias pactadas entre facciones oligárquicas, obstaculizó sistemáticamente la "
                + "participación política efectiva de amplios sectores sociales históricamente marginados.";
        var e = DifficultyEstimator.estimate(Language.ES, tokens(Language.ES, easy));
        var h = DifficultyEstimator.estimate(Language.ES, tokens(Language.ES, hard));
        assertThat(e.level()).isIn("A1", "A2");
        assertThat(h.level()).isIn("C1", "C2");
        assertThat(e.wordCount()).isEqualTo(26);
    }

    @Test
    void knownStatsCountIgnoredAsUnderstood() {
        var stats = TextService.stats(tokens(Language.ES, "Hola Pedro, hola mundo."),
                Map.of("hola", WordStatus.KNOWN, "pedro", WordStatus.IGNORED, "mundo", WordStatus.LEARNING));
        assertThat(stats.uniqueWords()).isEqualTo(3);
        assertThat(stats.knownPercent()).isEqualTo(66.7);
        assertThat(stats.unseen()).isZero();
    }

    @Test
    void alignsWordsWithinSubtitleCues() {
        var parsed = SubtitleParser.parse("1\n00:00:01,000 --> 00:00:02,000\nuno dos\n\n2\n00:00:05,000 --> 00:00:06,000\ntres\n");
        var timings = AudioAligner.fromCues(tokens(Language.ES, parsed.content()), parsed.cues());
        assertThat(timings).hasSize(3);
        assertThat(timings.get(0).s()).isEqualTo(1000);
        assertThat(timings.get(1).e()).isEqualTo(2000);
        assertThat(timings.get(2).s()).isEqualTo(5000);
    }

    @Test
    void estimatedAlignmentCoversDurationInOrder() {
        var timings = AudioAligner.estimate(tokens(Language.ES, "Uno dos tres. Cuatro cinco."), 10_000);
        assertThat(timings).hasSize(5);
        for (int i = 1; i < timings.size(); i++) {
            assertThat(timings.get(i).s()).isGreaterThanOrEqualTo(timings.get(i - 1).e());
        }
        assertThat(timings.getLast().e()).isLessThanOrEqualTo(10_000);
    }

    @Test
    void sentenceMarksSplitAudioBySentence() {
        var timings = AudioAligner.fromSentenceMarks(tokens(Language.ES, "Uno dos. Tres."),
                List.of(new AudioAligner.SentenceMark(0, 0), new AudioAligner.SentenceMark(1, 4000)), 6000);
        assertThat(timings).hasSize(3);
        assertThat(timings.get(1).e()).isEqualTo(4000);
        assertThat(timings.get(2).s()).isEqualTo(4000);
        assertThat(timings.get(2).e()).isEqualTo(6000);
    }

    @Test
    void extractsArticleParagraphs() {
        var doc = Jsoup.parse("""
                <html><head><meta property="og:title" content="Gran titular"><title>x</title></head><body>
                <nav><p>Menú</p></nav>
                <article><h1>Gran titular</h1><p>Primer párrafo con bastante texto para contar.</p>
                <p>Segundo párrafo.</p></article><footer><p>Copyright</p></footer></body></html>""");
        assertThat(UrlImporter.extractTitle(doc)).isEqualTo("Gran titular");
        assertThat(UrlImporter.extractBody(doc))
                .isEqualTo("Primer párrafo con bastante texto para contar.\n\nSegundo párrafo.");
    }

    @Test
    void truncatesLongArticlesAtParagraphs() {
        assertThat(UrlImporter.truncateAtParagraph("aaaa\n\nbbbb\n\ncccc", 12)).isEqualTo("aaaa\n\nbbbb");
        assertThat(UrlImporter.truncateAtParagraph("short", 12)).isEqualTo("short");
    }

    @Test
    void blocksInternalAddresses() {
        for (String url : List.of("http://127.0.0.1/", "http://10.1.2.3/", "http://192.168.0.1/", "http://169.254.169.254/",
                "http://[::1]/", "http://localhost/")) {
            assertThatThrownBy(() -> UrlImporter.assertPublicHost(URI.create(url)))
                    .as(url).hasMessageContaining("cannot be imported");
        }
    }
}
