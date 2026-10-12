package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.AppProperties;
import app.lector.text.SubtitleParser;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class TidyLinesTest {

    private static final TokenizationService TOKENIZER = new TokenizationService(
            new AppProperties(null, new AppProperties.Tokenizer("", null), null, null, null, List.of(), false, false),
            RestClient.builder());

    private static final Function<String, List<Token>> EN = text -> TOKENIZER.tokenize(Language.EN, text);

    private static Cue cue(long start, long end, String text, WordMark... marks) {
        return new Cue(start, end, text, 0, 0, List.of(marks));
    }

    private static final List<Cue> CUES = List.of(
            cue(0, 2000, "hello friends how are you"),
            cue(2000, 4000, "today we cook rice"));

    @Test
    void punctuationAndCapitalsAreAccepted() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "Today we cook rice."), EN);
        assertThat(tidied).isPresent();
        assertThat(tidied.get()).extracting(Cue::text)
                .containsExactly("Hello, friends. How are you?", "Today we cook rice.");
        assertThat(tidied.get()).extracting(Cue::startMs).containsExactly(0L, 2000L);
        assertThat(tidied.get()).extracting(Cue::endMs).containsExactly(2000L, 4000L);
    }

    @Test
    void aChangedWordIsRejected() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "Today we cook pasta."), EN))
                .isEmpty();
    }

    @Test
    void anAddedWordIsRejected() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, my friends. How are you?", "Today we cook rice."), EN))
                .isEmpty();
    }

    @Test
    void aDroppedWordIsRejected() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "Today we cook."), EN)).isEmpty();
    }

    @Test
    void aSpellingChangeIsRejected() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends. How're you?", "Today we cook rice."), EN))
                .isEmpty();
    }

    @Test
    void aWordMovedToAnotherLineIsRejected() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends. How are", "you? Today we cook rice."), EN))
                .isEmpty();
    }

    @Test
    void aMissingOrExtraLineIsRejected() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends. How are you? Today we cook rice."), EN)).isEmpty();
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends.", "How are you?", "Today we cook rice."), EN))
                .isEmpty();
        assertThat(TidyLines.apply(CUES, null, EN)).isEmpty();
    }

    @Test
    void aBlankLineIsRejected() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "  "), EN)).isEmpty();
    }

    @Test
    void whitespaceInsideALineIsTidiedToSingleSpaces() {
        var tidied = TidyLines.apply(CUES, List.of(" Hello,\nfriends.  How are you? ", "Today we cook rice."), EN);
        assertThat(tidied.get().getFirst().text()).isEqualTo("Hello, friends. How are you?");
    }

    @Test
    void wordMarksMoveWithTheirWords() {
        var marked = List.of(cue(0, 3000, "hello friends how are you",
                new WordMark(6, 500), new WordMark(14, 1000), new WordMark(18, 1500), new WordMark(22, 2000)));
        var tidied = TidyLines.apply(marked, List.of("Hello, friends. How are you?"), EN).get();
        assertThat(tidied.getFirst().words()).containsExactly(
                new WordMark(7, 500), new WordMark(16, 1000), new WordMark(20, 1500), new WordMark(24, 2000));
    }

    @Test
    void tidiedLinesRunOnWithParagraphBreaksWhereSuggested() {
        var part = new TidyLines.Part(List.of(
                cue(0, 1000, "Hello, friends."), cue(1000, 2000, "How are you?"), cue(2000, 3000, "Today we cook.")),
                Set.of(2), true);
        SubtitleParser.Parsed joined = TidyLines.join(List.of(part), " ");
        assertThat(joined.content()).isEqualTo("Hello, friends. How are you?\nToday we cook.");
        for (Cue c : joined.cues()) {
            assertThat(joined.content().substring(c.charStart(), c.charEnd())).isEqualTo(c.text());
        }
    }

    @Test
    void untidiedPartsKeepALinePerCaptionAndMeetTheirNeighboursOnANewLine() {
        var tidy = new TidyLines.Part(List.of(cue(0, 1000, "Hello, friends."), cue(1000, 2000, "How are you?")),
                Set.of(), true);
        var raw = new TidyLines.Part(List.of(cue(2000, 3000, "today we"), cue(3000, 4000, "cook rice")), Set.of(), false);
        var after = new TidyLines.Part(List.of(cue(4000, 5000, "It's good."), cue(5000, 6000, "Very good.")),
                Set.of(), true);
        SubtitleParser.Parsed joined = TidyLines.join(List.of(tidy, raw, after), " ");
        assertThat(joined.content())
                .isEqualTo("Hello, friends. How are you?\ntoday we\ncook rice\nIt's good. Very good.");
        assertThat(joined.cues()).extracting(Cue::startMs).containsExactly(0L, 1000L, 2000L, 3000L, 4000L, 5000L);
        for (Cue c : joined.cues()) {
            assertThat(joined.content().substring(c.charStart(), c.charEnd())).isEqualTo(c.text());
        }
    }

    @Test
    void languagesWithoutSpacesRunOnWithoutThem() {
        var part = new TidyLines.Part(List.of(cue(0, 1000, "今日は"), cue(1000, 2000, "いい天気です。")), Set.of(), true);
        assertThat(TidyLines.join(List.of(part), "").content()).isEqualTo("今日はいい天気です。");
    }

    @Test
    void onlyAutomaticTracksWithAlmostNoPunctuationNeedTidying() {
        String words = "and then we went to the market and we bought some bread and some cheese ".repeat(4);
        List<Cue> bare = List.of(cue(0, 1000, words), cue(1000, 2000, words + "okay."));
        List<Cue> punctuated = List.of(cue(0, 1000, words.replace("market", "market.")),
                cue(1000, 2000, words.replace("cheese", "cheese.")));
        assertThat(TidyLines.needsTidy(true, bare, EN)).isTrue();
        assertThat(TidyLines.needsTidy(false, bare, EN)).isFalse();
        assertThat(TidyLines.needsTidy(true, punctuated, EN)).isFalse();
    }
}
