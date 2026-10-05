package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.AppProperties;
import app.lector.text.AudioAligner.WordTiming;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Word timings from YouTube's per-word caption marks (srv3 {@code <s t>}), used instead of spreading a line. */
class AudioAlignerWordMarkTest {

    private static List<Token> tokens(String text) {
        var props = new AppProperties(null, new AppProperties.Tokenizer("", null), null, null, null, null, List.of(), false, false);
        return new TokenizationService(props, RestClient.builder()).tokenize(Language.FR, text);
    }

    private static List<WordTiming> align(Cue... cues) {
        var joined = SubtitleParser.join(List.of(cues));
        return AudioAligner.fromCues(tokens(joined.content()), joined.cues());
    }

    private static Cue cue(long start, long end, String text, WordMark... marks) {
        return new Cue(start, end, text, 0, 0, List.of(marks));
    }

    private static List<long[]> spans(List<WordTiming> timings) {
        return timings.stream().map(t -> new long[] {t.s(), t.e()}).toList();
    }

    @Test
    void eachWordStartsAtItsOwnMarkAndEndsWhereTheNextBegins() {
        var timings = align(cue(1000, 3000, "Hola mundo", new WordMark(0, 1000), new WordMark(5, 1600)));
        assertThat(spans(timings)).containsExactly(new long[] {1000, 1600}, new long[] {1600, 3000});
    }

    @Test
    void marksBeatAnEvenSpreadOfUnevenSpeech() {
        // Spread by length, "deux" would start at 1000; the mark says the speaker paused first.
        var timings = align(cue(0, 3000, "un deux trois",
                new WordMark(0, 0), new WordMark(3, 2000), new WordMark(8, 2400)));
        assertThat(spans(timings)).containsExactly(new long[] {0, 2000}, new long[] {2000, 2400}, new long[] {2400, 3000});
    }

    @Test
    void tokensSharingOneMarkSplitItsTime() {
        var timings = align(cue(0, 3000, "un deux trois", new WordMark(0, 0), new WordMark(8, 2000)));
        assertThat(timings).hasSize(3);
        assertThat(timings.get(0).s()).isZero();
        assertThat(timings.get(0).e()).isEqualTo(timings.get(1).s()).isBetween(1L, 1999L);
        assertThat(timings.get(1).e()).isEqualTo(2000);
        assertThat(spans(timings).get(2)).containsExactly(2000, 3000);
    }

    @Test
    void wordsBeforeTheFirstMarkRunFromTheLineStart() {
        var timings = align(cue(500, 2000, "un deux", new WordMark(3, 1200)));
        assertThat(spans(timings)).containsExactly(new long[] {500, 1200}, new long[] {1200, 2000});
    }

    @Test
    void marksPastTheNextLinesStartAreClampedToKeepWordsInOrder() {
        var timings = align(
                cue(0, 3000, "un deux", new WordMark(0, 0), new WordMark(3, 2500)),
                cue(2000, 4000, "trois", new WordMark(0, 2000)));
        assertThat(spans(timings)).containsExactly(new long[] {0, 2000}, new long[] {2000, 2000}, new long[] {2000, 4000});
    }

    @Test
    void marksOutOfOrderOrBeforeTheLineNeverRunBackwards() {
        var timings = align(cue(1000, 3000, "un deux trois",
                new WordMark(0, 500), new WordMark(3, 2000), new WordMark(8, 1500)));
        assertThat(spans(timings)).containsExactly(new long[] {1000, 2000}, new long[] {2000, 2000}, new long[] {2000, 3000});
    }

    @Test
    void aMarkOnNonWordTextLeavesAGapAfterThePreviousWord() {
        // The "," mark covers no word: "un" ends there, and "deux" starts at its own mark.
        var timings = align(cue(0, 3000, "un , deux",
                new WordMark(0, 0), new WordMark(3, 800), new WordMark(5, 2000)));
        assertThat(timings.getFirst().e()).isEqualTo(800);
        assertThat(timings.getLast().s()).isEqualTo(2000);
        assertThat(timings.getLast().e()).isEqualTo(3000);
    }

    @Test
    void linesWithAndWithoutMarksMix() {
        var timings = align(cue(0, 1000, "un deux"), cue(1000, 2000, "trois quatre",
                new WordMark(0, 1000), new WordMark(6, 1100)));
        assertThat(spans(timings)).containsExactly(
                new long[] {0, 375}, new long[] {375, 1000}, new long[] {1000, 1100}, new long[] {1100, 2000});
    }

    @Test
    void cuesStoredBeforeWordMarksReadBackWithNone() {
        var json = JsonMapper.builder().build();
        List<Cue> old = json.readValue("[{\"startMs\":0,\"endMs\":10,\"text\":\"un\",\"charStart\":0,\"charEnd\":2}]",
                new TypeReference<List<Cue>>() {});
        assertThat(old.getFirst().words()).isEmpty();
        Cue marked = cue(0, 10, "un", new WordMark(0, 5));
        assertThat(json.readValue(json.writeValueAsString(List.of(marked)), new TypeReference<List<Cue>>() {}))
                .containsExactly(marked);
    }

    @Test
    void joiningKeepsTheMarks() {
        var joined = SubtitleParser.join(List.of(cue(0, 1, "un"), cue(1, 2, "deux", new WordMark(0, 1))));
        assertThat(joined.cues().get(1).words()).containsExactly(new WordMark(0, 1));
        assertThat(joined.cues().get(1).charStart()).isEqualTo(3);
    }
}
