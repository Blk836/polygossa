package app.lector.video;

import app.lector.text.SubtitleParser;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.HashSet;
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

    private record Word(int offset, String key, String text) {}

    static final int WORDS_PER_SENTENCE_MARK = 40;
    static final int PARAGRAPH_WORDS = 100;

    private static final Set<String> FILLERS = Set.of("euh", "heu", "hum", "hmm", "hm", "mm", "mmm", "um", "umm",
            "uh", "uhm", "er", "erm", "äh", "ähm", "öh", "ehm", "eh", "ah", "eeh", "emm");
    private static final Pattern SENTENCE_MARK = Pattern.compile("[.!?…。！？]");
    private static final Pattern SENTENCE_END = Pattern.compile("[.!?…。！？][\"'»”’)\\]]*\\s*$");
    private static final Pattern NOT_WORD = Pattern.compile("[^\\p{L}\\p{N}]");
    private static final Pattern SPACE = Pattern.compile("\\s+");

    private TidyLines() {}

    static boolean unpunctuated(List<Cue> cues, Function<String, List<Token>> tokenize) {
        long words = 0;
        long marks = 0;
        for (Cue cue : cues) {
            words += wordCount(cue.text(), tokenize);
            marks += SENTENCE_MARK.matcher(cue.text()).results().count();
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
            Cue cue = cues.get(i);
            out.add(retext(cue, lines.get(i), tokenize).orElse(cue));
        }
        return Optional.of(out);
    }

    static Part punctuated(List<Cue> cues, Function<String, List<Token>> tokenize) {
        Set<Integer> starts = new HashSet<>();
        int words = 0;
        for (int i = 0; i + 1 < cues.size(); i++) {
            words += wordCount(cues.get(i).text(), tokenize);
            if (words >= PARAGRAPH_WORDS && SENTENCE_END.matcher(cues.get(i).text()).find()) {
                starts.add(i + 1);
                words = 0;
            }
        }
        return new Part(cues, starts, true);
    }

    private static Optional<Cue> retext(Cue cue, String line, Function<String, List<Token>> tokenize) {
        String text = line == null ? "" : SPACE.matcher(line).replaceAll(" ").strip();
        List<Word> before = words(cue.text(), tokenize);
        if (text.isEmpty()) {
            return Optional.empty();
        }
        Optional<String> restored = withFillers(before, text, tokenize);
        if (restored.isEmpty()) {
            return Optional.empty();
        }
        List<Word> after = words(restored.get(), tokenize);
        if (!keys(before).equals(keys(after))) {
            return Optional.empty();
        }
        List<WordMark> marks = new ArrayList<>();
        for (WordMark mark : cue.words()) {
            int k = firstAtOrAfter(before, mark.offset());
            if (k < after.size()) {
                marks.add(new WordMark(after.get(k).offset(), mark.startMs()));
            }
        }
        return Optional.of(new Cue(cue.startMs(), cue.endMs(), restored.get(), 0, 0, marks));
    }

    private static Optional<String> withFillers(List<Word> before, String text, Function<String, List<Token>> tokenize) {
        List<Word> after = words(text, tokenize);
        StringBuilder out = new StringBuilder(text);
        int shift = 0;
        int j = 0;
        for (Word word : before) {
            if (j < after.size() && after.get(j).key().equals(word.key())) {
                j++;
            } else if (FILLERS.contains(word.key())) {
                boolean atEnd = j == after.size();
                String insert = atEnd ? " " + word.text() : word.text() + " ";
                out.insert(atEnd ? out.length() : after.get(j).offset() + shift, insert);
                shift += insert.length();
            } else {
                return Optional.empty();
            }
        }
        return j == after.size() ? Optional.of(out.toString()) : Optional.empty();
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
                out.add(new Word(offset, key, t.text()));
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
