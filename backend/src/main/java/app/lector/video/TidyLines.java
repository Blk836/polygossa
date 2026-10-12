package app.lector.video;

import app.lector.text.SubtitleParser;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;

final class TidyLines {

    record Part(List<Cue> cues, Set<Integer> paragraphStarts, boolean tidied) {

        static Part untidied(List<Cue> cues) {
            return new Part(cues, Set.of(), false);
        }
    }

    private record Word(int offset, String key) {}

    static final int WORDS_PER_SENTENCE_MARK = 40;

    private static final Pattern SENTENCE_END = Pattern.compile("[.!?…。！？]");
    private static final Pattern NOT_WORD = Pattern.compile("[^\\p{L}\\p{N}]");
    private static final Pattern SPACE = Pattern.compile("\\s+");

    private TidyLines() {}

    static boolean needsTidy(boolean automatic, List<Cue> cues, Function<String, List<Token>> tokenize) {
        if (!automatic) {
            return false;
        }
        long words = 0;
        long marks = 0;
        for (Cue cue : cues) {
            words += wordCount(cue.text(), tokenize);
            marks += SENTENCE_END.matcher(cue.text()).results().count();
        }
        return words > 0 && marks * WORDS_PER_SENTENCE_MARK < words;
    }

    static int wordCount(String text, Function<String, List<Token>> tokenize) {
        return words(text, tokenize).size();
    }

    static Optional<List<Cue>> apply(List<Cue> cues, List<String> lines, Function<String, List<Token>> tokenize) {
        if (lines == null || lines.size() != cues.size()) {
            return Optional.empty();
        }
        List<Cue> out = new ArrayList<>();
        for (int i = 0; i < cues.size(); i++) {
            Optional<Cue> retexted = retext(cues.get(i), lines.get(i), tokenize);
            if (retexted.isEmpty()) {
                return Optional.empty();
            }
            out.add(retexted.get());
        }
        return Optional.of(out);
    }

    private static Optional<Cue> retext(Cue cue, String line, Function<String, List<Token>> tokenize) {
        String text = line == null ? "" : SPACE.matcher(line).replaceAll(" ").strip();
        List<Word> before = words(cue.text(), tokenize);
        List<Word> after = words(text, tokenize);
        if (text.isEmpty() || !keys(before).equals(keys(after))) {
            return Optional.empty();
        }
        List<WordMark> marks = new ArrayList<>();
        for (WordMark mark : cue.words()) {
            int k = firstAtOrAfter(before, mark.offset());
            if (k < after.size()) {
                marks.add(new WordMark(after.get(k).offset(), mark.startMs()));
            }
        }
        return Optional.of(new Cue(cue.startMs(), cue.endMs(), text, 0, 0, marks));
    }

    static SubtitleParser.Parsed join(List<Part> parts, String separator) {
        StringBuilder content = new StringBuilder();
        List<Cue> placed = new ArrayList<>();
        boolean previousTidied = false;
        for (Part part : parts) {
            for (int i = 0; i < part.cues().size(); i++) {
                Cue cue = part.cues().get(i);
                if (!content.isEmpty()) {
                    boolean runOn = part.tidied() && previousTidied && !part.paragraphStarts().contains(i);
                    content.append(runOn ? separator : "\n");
                }
                int start = content.length();
                content.append(cue.text());
                placed.add(new Cue(cue.startMs(), cue.endMs(), cue.text(), start, content.length(), cue.words()));
                previousTidied = part.tidied();
            }
        }
        return new SubtitleParser.Parsed(content.toString(), placed);
    }

    private static List<Word> words(String text, Function<String, List<Token>> tokenize) {
        List<Word> out = new ArrayList<>();
        int offset = 0;
        for (Token t : tokenize.apply(text)) {
            String key = NOT_WORD.matcher(t.text()).replaceAll("").toLowerCase(Locale.ROOT);
            if (t.word() && !key.isEmpty()) {
                out.add(new Word(offset, key));
            }
            offset += t.text().length();
        }
        return out;
    }

    private static List<String> keys(List<Word> words) {
        return words.stream().map(Word::key).toList();
    }

    private static int firstAtOrAfter(List<Word> words, int offset) {
        int k = 0;
        while (k < words.size() && words.get(k).offset() < offset) {
            k++;
        }
        return k;
    }
}
