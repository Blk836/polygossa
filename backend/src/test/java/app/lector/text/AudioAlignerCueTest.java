package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.AppProperties;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/** Word timings built from subtitle/caption cues, including YouTube's overlapping (rolling) captions. */
class AudioAlignerCueTest {

    private record Line(long start, long end, String text) {}

    private static List<Token> tokens(String text) {
        var props = new AppProperties(null, new AppProperties.Tokenizer("", null), null, null, null, List.of(), false, false);
        return new TokenizationService(props, RestClient.builder()).tokenize(Language.FR, text);
    }

    /** Joins the lines in the given (transcript) order and aligns the transcript's words to them. */
    private static List<AudioAligner.WordTiming> align(Line... lines) {
        List<SubtitleParser.Cue> raw = new ArrayList<>();
        for (Line l : lines) {
            raw.add(new SubtitleParser.Cue(l.start(), l.end(), l.text(), 0, 0));
        }
        var joined = SubtitleParser.join(raw);
        return AudioAligner.fromCues(tokens(joined.content()), joined.cues());
    }

    private static void assertTranscriptOrderByStart(List<AudioAligner.WordTiming> timings) {
        var byStart = timings.stream()
                .sorted(Comparator.comparingLong(AudioAligner.WordTiming::s).thenComparingInt(AudioAligner.WordTiming::i))
                .map(AudioAligner.WordTiming::i).toList();
        var byIndex = timings.stream().map(AudioAligner.WordTiming::i).sorted().toList();
        assertThat(byStart).isEqualTo(byIndex);
    }

    @Test
    void overlappingCuesNeverInterleaveWords() {
        var timings = align(new Line(0, 3000, "un deux trois"), new Line(2000, 4000, "quatre cinq"));
        assertThat(timings).hasSize(5);
        for (int k = 0; k < 3; k++) {
            assertThat(timings.get(k).s()).isLessThanOrEqualTo(2000);
            assertThat(timings.get(k).e()).isLessThanOrEqualTo(2000);
        }
        assertThat(timings.get(2).e()).isEqualTo(2000);
        assertThat(timings.get(3).s()).isEqualTo(2000);
        assertThat(timings.get(4).e()).isEqualTo(4000);
        assertTranscriptOrderByStart(timings);
    }

    @Test
    void rollingCaptionsLikeE188StayInTranscriptOrder() {
        // Shape of innerFrench E188: each line stays up until well after the next one starts.
        var timings = align(
                new Line(14_000, 17_920, "à toutes et à tous Je suis"),
                new Line(15_799, 19_765, "ravi de vous retrouver pour ce"),
                new Line(17_920, 21_000, "épisode de la semaine"));
        assertTranscriptOrderByStart(timings);
        for (int k = 1; k < timings.size(); k++) {
            assertThat(timings.get(k).s()).isGreaterThanOrEqualTo(timings.get(k - 1).e());
        }
    }

    @Test
    void nonOverlappingCuesKeepTheirBoundsAndGaps() {
        var timings = align(new Line(0, 1000, "un deux"), new Line(1500, 2500, "trois"));
        assertThat(timings).hasSize(3);
        assertThat(timings.get(0).s()).isZero();
        assertThat(timings.get(1).e()).isEqualTo(1000);
        assertThat(timings.get(2).s()).isEqualTo(1500);
        assertThat(timings.get(2).e()).isEqualTo(2500);
    }

    @Test
    void cueEndingExactlyAtNextStartIsUnchanged() {
        var timings = align(new Line(0, 1000, "un"), new Line(1000, 2000, "deux"));
        assertThat(timings.get(0).e()).isEqualTo(1000);
        assertThat(timings.get(1).s()).isEqualTo(1000);
    }

    @Test
    void lastCueKeepsItsOwnEnd() {
        var timings = align(new Line(4000, 6000, "un"), new Line(5000, 7000, "deux trois"));
        assertThat(timings.getLast().e()).isEqualTo(7000);
        assertThat(timings.getFirst().e()).isEqualTo(5000);
    }

    @Test
    void cuesListedOutOfStartOrderAreClampedByTheNextCueInTime() {
        // Transcript order B, A; time order A (0–3000), B (2000–4000): A is clamped at 2000, B keeps its end.
        var timings = align(new Line(2000, 4000, "quatre cinq"), new Line(0, 3000, "un deux trois"));
        assertThat(timings).hasSize(5);
        assertThat(timings.get(1).e()).isEqualTo(4000);
        assertThat(timings.get(4).e()).isEqualTo(2000);
        assertThat(timings.get(2).s()).isZero();
    }

    @Test
    void cuesStartingTogetherOrNestedNeverProduceNegativeSpans() {
        var same = align(new Line(0, 3000, "un deux"), new Line(0, 1000, "trois"));
        var nested = align(new Line(0, 5000, "un deux"), new Line(1000, 2000, "trois"), new Line(1500, 1800, "quatre"));
        for (var t : same) {
            assertThat(t.e()).isGreaterThanOrEqualTo(t.s());
        }
        for (var t : nested) {
            assertThat(t.e()).isGreaterThanOrEqualTo(t.s());
        }
        assertThat(nested.get(0).s()).isZero();
        assertThat(nested.get(1).e()).isEqualTo(1000);
        assertThat(nested.get(2).e()).isEqualTo(1500);
        assertThat(nested.get(3).e()).isEqualTo(1800);
    }

    @Test
    void aLongTranscriptTimesEveryWordOnceInsideItsOwnCue() {
        // 300 three-second cues of four words: each word lands in its cue's three seconds, in transcript order.
        Line[] lines = new Line[300];
        for (int c = 0; c < lines.length; c++) {
            String w = letters(c);
            lines[c] = new Line(c * 3000L, c * 3000L + 3000, w + "a " + w + "b " + w + "c " + w + "d");
        }
        var timings = align(lines);
        assertThat(timings).hasSize(1200);
        assertThat(timings.stream().map(AudioAligner.WordTiming::i).distinct().count()).isEqualTo(1200);
        for (int k = 0; k < timings.size(); k++) {
            long cueStart = (k / 4) * 3000L;
            assertThat(timings.get(k).s()).isBetween(cueStart, cueStart + 3000);
            assertThat(timings.get(k).e()).isBetween(cueStart, cueStart + 3000);
        }
        assertTranscriptOrderByStart(timings);
    }

    /** A letters-only name for n (the tokenizer would split digits off a word). */
    private static String letters(int n) {
        return "m" + (char) ('a' + n / 26 / 26 % 26) + (char) ('a' + n / 26 % 26) + (char) ('a' + n % 26);
    }

    @Test
    void firstAtOrAfterFindsTheLowerBound() {
        int[] sorted = {0, 3, 3, 7, 10};
        assertThat(AudioAligner.firstAtOrAfter(sorted, -1)).isZero();
        assertThat(AudioAligner.firstAtOrAfter(sorted, 0)).isZero();
        assertThat(AudioAligner.firstAtOrAfter(sorted, 1)).isEqualTo(1);
        assertThat(AudioAligner.firstAtOrAfter(sorted, 3)).isEqualTo(1);
        assertThat(AudioAligner.firstAtOrAfter(sorted, 4)).isEqualTo(3);
        assertThat(AudioAligner.firstAtOrAfter(sorted, 10)).isEqualTo(4);
        assertThat(AudioAligner.firstAtOrAfter(sorted, 11)).isEqualTo(5);
        assertThat(AudioAligner.firstAtOrAfter(new int[0], 5)).isZero();
    }
}
