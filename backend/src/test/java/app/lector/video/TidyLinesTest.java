package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.config.AppProperties;
import app.lector.text.AudioAligner;
import app.lector.text.AudioAligner.WordTiming;
import app.lector.text.SubtitleParser;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import java.util.ArrayList;
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
    private static final Function<String, List<Token>> FR = text -> TOKENIZER.tokenize(Language.FR, text);

    private static Cue cue(long start, long end, String text, WordMark... marks) {
        return new Cue(start, end, text, 0, 0, List.of(marks));
    }

    private static final List<Cue> CUES = List.of(
            cue(0, 2000, "hello friends how are you"),
            cue(2000, 4000, "today we cook rice"));

    private static List<String> texts(List<Cue> cues) {
        return cues.stream().map(Cue::text).toList();
    }

    @Test
    void punctuationAndCapitalsAreAccepted() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "Today we cook rice."), EN);
        assertThat(tidied).isPresent();
        assertThat(texts(tidied.get())).containsExactly("Hello, friends. How are you?", "Today we cook rice.");
        assertThat(tidied.get()).extracting(Cue::startMs).containsExactly(0L, 2000L);
        assertThat(tidied.get()).extracting(Cue::endMs).containsExactly(2000L, 4000L);
    }

    @Test
    void aWordTheAiChangedIsPutBackWithItsPunctuationKept() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "Today we cook pasta."), EN);
        assertThat(texts(tidied.get())).containsExactly("Hello, friends. How are you?", "Today we cook rice.");
    }

    @Test
    void tooManyChangedWordsKeepThatLineOriginal() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "Tomorrow they eat pasta."), EN);
        assertThat(texts(tidied.get())).containsExactly("Hello, friends. How are you?", "today we cook rice");
    }

    @Test
    void anAddedWordKeepsOnlyThatLineOriginal() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, my friends. How are you?", "Today we cook rice."), EN);
        assertThat(texts(tidied.get())).containsExactly("hello friends how are you", "Today we cook rice.");
    }

    @Test
    void aDroppedWordKeepsOnlyThatLineOriginal() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "Today we cook."), EN);
        assertThat(texts(tidied.get())).containsExactly("Hello, friends. How are you?", "today we cook rice");
    }

    @Test
    void aSpellingChangeKeepsOnlyThatLineOriginal() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How're you?", "Today we cook rice."), EN);
        assertThat(texts(tidied.get())).containsExactly("hello friends how are you", "Today we cook rice.");
    }

    @Test
    void aWordMovedToAnotherLineGoesBackToItsOwnLine() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How are", "you? Today we cook rice."), EN);
        assertThat(texts(tidied.get())).containsExactly("Hello, friends. How are you?", "Today we cook rice.");
    }

    @Test
    void mergedOrSplitLinesAreCutBackAtTheOriginalLines() {
        assertThat(texts(TidyLines.apply(CUES, List.of("Hello, friends. How are you? Today we cook rice."), EN).get()))
                .containsExactly("Hello, friends. How are you?", "Today we cook rice.");
        assertThat(texts(TidyLines.apply(CUES, List.of("Hello, friends.", "How are you?", "Today we cook rice."), EN)
                .get())).containsExactly("Hello, friends. How are you?", "Today we cook rice.");
    }

    @Test
    void openingMarksStayWithTheWordAfterThem() {
        var cues = List.of(cue(0, 1000, "hola amigos cómo"), cue(1000, 2000, "estáis hoy"));
        var es = (Function<String, List<Token>>) text -> TOKENIZER.tokenize(Language.ES, text);
        assertThat(texts(TidyLines.apply(cues, List.of("¡Hola, amigos! ¿Cómo estáis hoy?"), es).get()))
                .containsExactly("¡Hola, amigos! ¿Cómo", "estáis hoy?");
    }

    @Test
    void theWrongNumberOfLinesWithAnAddedWordLeavesThePartUntidied() {
        assertThat(TidyLines.apply(CUES, List.of("Hello, friends. How are you? Today we cook the rice."), EN)).isEmpty();
        assertThat(TidyLines.apply(CUES, null, EN)).isEmpty();
    }

    @Test
    void aWordMovedAcrossLinesKeepsItsTime() {
        var marked = List.of(cue(0, 2000, "hello friends how are", new WordMark(6, 500), new WordMark(14, 1000),
                new WordMark(18, 1500)), cue(2000, 4000, "you today", new WordMark(4, 3000)));
        var tidied = TidyLines.apply(marked, List.of("Hello, friends. How", "are you? Today."), EN).get();
        assertThat(texts(tidied)).containsExactly("Hello, friends. How are", "you? Today.");
        assertThat(tidied.get(0).words()).containsExactly(new WordMark(7, 500), new WordMark(16, 1000),
                new WordMark(20, 1500));
        assertThat(tidied.get(1).words()).containsExactly(new WordMark(5, 3000));
    }

    @Test
    void aChangedWordInAReplyWithTheWrongNumberOfLinesIsPutBackToo() {
        assertThat(texts(TidyLines.apply(CUES, List.of("Hello, friends. How are you? Today we cook pasta."), EN).get()))
                .containsExactly("Hello, friends. How are you?", "Today we cook rice.");
    }

    @Test
    void aBlankLineKeepsThatLineOriginal() {
        var tidied = TidyLines.apply(CUES, List.of("Hello, friends. How are you?", "  "), EN);
        assertThat(texts(tidied.get())).containsExactly("Hello, friends. How are you?", "today we cook rice");
    }

    @Test
    void whitespaceInsideALineIsTidiedToSingleSpaces() {
        var tidied = TidyLines.apply(CUES, List.of(" Hello,\nfriends.  How are you? ", "Today we cook rice."), EN);
        assertThat(tidied.get().getFirst().text()).isEqualTo("Hello, friends. How are you?");
    }

    @Test
    void aFillerTheAiDroppedIsPutBackInItsPlace() {
        var cues = List.of(cue(0, 3000, "et euh je pense que oui"), cue(3000, 5000, "euh voilà"));
        var tidied = TidyLines.apply(cues, List.of("Et je pense que oui.", "Voilà."), FR);
        assertThat(texts(tidied.get())).containsExactly("Et euh je pense que oui.", "euh Voilà.");
    }

    @Test
    void aFillerKeptByTheAiStaysAsItWrote() {
        var cues = List.of(cue(0, 3000, "et euh je pense que oui"));
        var tidied = TidyLines.apply(cues, List.of("Et, euh, je pense que oui."), FR);
        assertThat(texts(tidied.get())).containsExactly("Et, euh, je pense que oui.");
    }

    @Test
    void aDroppedWordThatIsNotAFillerStillFailsTheLine() {
        var cues = List.of(cue(0, 3000, "et alors je pense que oui"));
        var tidied = TidyLines.apply(cues, List.of("Et je pense que oui."), FR);
        assertThat(texts(tidied.get())).containsExactly("et alors je pense que oui");
    }

    @Test
    void wordMarksMoveWithTheirWords() {
        var marked = List.of(cue(0, 3000, "hello friends how are you",
                new WordMark(6, 500), new WordMark(14, 1000), new WordMark(18, 1500), new WordMark(22, 2000)));
        var tidied = TidyLines.apply(marked, List.of("Hello, friends. How are you?"), EN).get();
        assertThat(tidied.getFirst().words()).containsExactly(
                new WordMark(7, 500), new WordMark(16, 1000), new WordMark(20, 1500), new WordMark(24, 2000));
    }

    private record Timed(String word, long s, long e) {}

    private static List<Timed> wordTimes(SubtitleParser.Parsed parsed) {
        List<Token> tokens = FR.apply(parsed.content());
        List<Timed> out = new ArrayList<>();
        for (WordTiming t : AudioAligner.fromCues(tokens, parsed.cues())) {
            out.add(new Timed(tokens.get(t.i()).text().toLowerCase(java.util.Locale.ROOT), t.s(), t.e()));
        }
        return out;
    }

    private static final List<Cue> PODCAST = List.of(
            cue(0, 2400, "bonjour à tous et bienvenue dans ce 6e",
                    new WordMark(8, 400), new WordMark(10, 600), new WordMark(15, 900), new WordMark(18, 1100),
                    new WordMark(28, 1600), new WordMark(33, 1900), new WordMark(36, 2100)),
            cue(2400, 3600, "épisode du cotong", new WordMark(8, 3000), new WordMark(11, 3200)),
            cue(3600, 6000, "podcast j'espère que vous allez bien et",
                    new WordMark(8, 4000), new WordMark(17, 4600), new WordMark(21, 4900),
                    new WordMark(26, 5200), new WordMark(32, 5500), new WordMark(37, 5800)),
            cue(6000, 8000, "euh que vous êtes en forme",
                    new WordMark(4, 6500), new WordMark(8, 6800), new WordMark(13, 7100),
                    new WordMark(18, 7400), new WordMark(21, 7700)));

    @Test
    void everyWordKeepsExactlyItsTimeAfterTidying() {
        var tidied = TidyLines.apply(PODCAST, List.of(
                "Bonjour à tous et bienvenue dans ce 6e",
                "épisode du Cotong",
                "podcast. J’espère que vous allez bien et",
                "que vous êtes en forme ?"), FR).get();
        assertThat(texts(tidied)).containsExactly("Bonjour à tous et bienvenue dans ce 6e", "épisode du Cotong",
                "podcast. J’espère que vous allez bien et", "euh que vous êtes en forme ?");
        var before = wordTimes(SubtitleParser.join(PODCAST));
        var after = wordTimes(TidyLines.join(List.of(new TidyLines.Part(tidied, Set.of(), true)), " "));
        assertThat(after).hasSize(before.size());
        for (int k = 0; k < before.size(); k++) {
            assertThat(after.get(k).s()).as("start of word %d (%s)", k, before.get(k).word()).isEqualTo(before.get(k).s());
            assertThat(after.get(k).e()).as("end of word %d (%s)", k, before.get(k).word()).isEqualTo(before.get(k).e());
        }
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
    void punctuatedCaptionsRunOnAndStartAParagraphAtASentenceEndAfterEnoughWords() {
        String long1 = "word ".repeat(TidyLines.PARAGRAPH_WORDS - 2) + "and then";
        var cues = List.of(cue(0, 1000, "Hello there."), cue(1000, 2000, long1),
                cue(2000, 3000, "it ended."), cue(3000, 4000, "A new one"), cue(4000, 5000, "starts here."));
        SubtitleParser.Parsed joined = TidyLines.join(List.of(TidyLines.punctuated(cues, EN)), " ");
        assertThat(joined.content())
                .isEqualTo("Hello there. " + long1 + " it ended.\nA new one starts here.");
        for (Cue c : joined.cues()) {
            assertThat(joined.content().substring(c.charStart(), c.charEnd())).isEqualTo(c.text());
        }
    }

    @Test
    void onlyAutomaticTracksWithAlmostNoPunctuationNeedTidying() {
        String words = "and then we went to the market and we bought some bread and some cheese ".repeat(4);
        List<Cue> bare = List.of(cue(0, 1000, words), cue(1000, 2000, words + "okay."));
        List<Cue> punctuated = List.of(cue(0, 1000, words.replace("market", "market.")),
                cue(1000, 2000, words.replace("cheese", "cheese.")));
        assertThat(TidyLines.unpunctuated(bare, EN)).isTrue();
        assertThat(TidyLines.unpunctuated(punctuated, EN)).isFalse();
    }
}
