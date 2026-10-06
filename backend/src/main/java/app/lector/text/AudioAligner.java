package app.lector.text;

import app.lector.token.Token;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Produces per-word audio timings for synchronized playback. Three sources, best first:
 * subtitle cues (exact cue boundaries), sentence marks tapped by the user while listening, or an estimate that
 * spreads the audio duration over the words in proportion to their length with pauses at sentence breaks.
 */
public final class AudioAligner {

    /** Timing of one word token. */
    public record WordTiming(int i, long s, long e) {}

    /** A user-tapped sentence start. */
    public record SentenceMark(int sentence, long startMs) {}

    private static final double SENTENCE_PAUSE_WEIGHT = 4.0;
    private static final double WORD_GAP_WEIGHT = 1.0;

    private AudioAligner() {}

    public static List<WordTiming> fromCues(List<Token> tokens, List<SubtitleParser.Cue> cues) {
        int[] offsets = charOffsets(tokens);
        // Where each token starts, in list order: never decreasing, so each cue's words are found by binary search
        // instead of scanning the whole transcript once per cue (a long video's reader page did that on every load).
        int[] starts = new int[tokens.size()];
        for (int i = 0; i < starts.length; i++) {
            starts[i] = offsets[tokens.get(i).index()];
        }
        long[] ends = clampedEnds(cues);
        List<WordTiming> out = new ArrayList<>();
        for (int c = 0; c < cues.size(); c++) {
            SubtitleParser.Cue cue = cues.get(c);
            List<Token> inCue = new ArrayList<>();
            for (int i = firstAtOrAfter(starts, cue.charStart()); i < starts.length && starts[i] < cue.charEnd(); i++) {
                if (tokens.get(i).word()) {
                    inCue.add(tokens.get(i));
                }
            }
            out.addAll(cue.words().isEmpty() ? spread(inCue, cue.startMs(), ends[c]) : byMarks(inCue, offsets, cue, ends[c]));
        }
        return out;
    }

    /** The first position whose value is at least {@code value} ({@code sorted.length} when there is none). */
    static int firstAtOrAfter(int[] sorted, int value) {
        int lo = 0;
        int hi = sorted.length;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (sorted[mid] < value) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /** A stretch of a cue's text, from {@code offset}, spoken from {@code ms}. */
    private record Bound(int offset, long ms) {}

    /**
     * Words timed by the cue's word marks: the words from one mark up to the next share that stretch of time (one
     * word, unless the transcript splits a caption word into several tokens). Marks are clamped into the cue and kept
     * in order, so words never run backwards or into the next cue.
     */
    private static List<WordTiming> byMarks(List<Token> words, int[] offsets, SubtitleParser.Cue cue, long endMs) {
        List<Bound> bounds = bounds(cue, endMs);
        List<WordTiming> out = new ArrayList<>();
        for (int k = 0; k < bounds.size(); k++) {
            boolean last = k + 1 == bounds.size();
            int from = cue.charStart() + bounds.get(k).offset();
            int to = last ? Integer.MAX_VALUE : cue.charStart() + bounds.get(k + 1).offset();
            List<Token> group = words.stream().filter(t -> offsets[t.index()] >= from && offsets[t.index()] < to).toList();
            out.addAll(spread(group, bounds.get(k).ms(), last ? endMs : bounds.get(k + 1).ms()));
        }
        return out;
    }

    private static List<Bound> bounds(SubtitleParser.Cue cue, long endMs) {
        // Words before the first mark run from the cue's start (an empty stretch when the first mark is at 0).
        List<Bound> out = new ArrayList<>(List.of(new Bound(0, cue.startMs())));
        long previous = cue.startMs();
        for (SubtitleParser.WordMark m : cue.words()) {
            previous = Math.min(Math.max(m.startMs(), previous), Math.max(endMs, cue.startMs()));
            out.add(new Bound(m.offset(), previous));
        }
        return out;
    }

    /**
     * Each cue's end, cut off at the start of the cue that follows it in time. YouTube keeps a caption line on
     * screen after the next one starts; spreading words over that overlap would interleave the two lines.
     */
    private static long[] clampedEnds(List<SubtitleParser.Cue> cues) {
        List<Integer> byStart = new ArrayList<>();
        for (int c = 0; c < cues.size(); c++) {
            byStart.add(c);
        }
        byStart.sort(Comparator.comparingLong(c -> cues.get(c).startMs()));
        long[] ends = new long[cues.size()];
        for (int k = 0; k < byStart.size(); k++) {
            int c = byStart.get(k);
            long end = cues.get(c).endMs();
            ends[c] = k + 1 < byStart.size() ? Math.min(end, cues.get(byStart.get(k + 1)).startMs()) : end;
        }
        return ends;
    }

    public static List<WordTiming> fromSentenceMarks(List<Token> tokens, List<SentenceMark> marks, long durationMs) {
        Map<Integer, List<Token>> bySentence = groupWordsBySentence(tokens);
        TreeMap<Integer, Long> starts = new TreeMap<>();
        for (SentenceMark m : marks) {
            starts.put(m.sentence(), m.startMs());
        }
        List<WordTiming> out = new ArrayList<>();
        List<Integer> marked = new ArrayList<>(starts.keySet());
        for (int k = 0; k < marked.size(); k++) {
            int first = marked.get(k);
            long start = starts.get(first);
            int nextSentence = k + 1 < marked.size() ? marked.get(k + 1) : Integer.MAX_VALUE;
            long end = k + 1 < marked.size() ? starts.get(nextSentence) : Math.max(start, durationMs);
            List<Token> words = new ArrayList<>();
            bySentence.forEach((sentence, ws) -> {
                if (sentence >= first && sentence < nextSentence) {
                    words.addAll(ws);
                }
            });
            words.sort(Comparator.comparingInt(Token::index));
            out.addAll(spread(words, start, end));
        }
        return out;
    }

    public static List<WordTiming> estimate(List<Token> tokens, long durationMs) {
        double total = 0;
        for (Token t : tokens) {
            total += weight(t);
        }
        if (total == 0) {
            return List.of();
        }
        List<WordTiming> out = new ArrayList<>();
        double cursor = 0;
        for (Token t : tokens) {
            double w = weight(t);
            long s = Math.round(cursor / total * durationMs);
            cursor += w;
            if (t.word()) {
                out.add(new WordTiming(t.index(), s, Math.round(cursor / total * durationMs)));
            }
        }
        return out;
    }

    private static double weight(Token t) {
        if (t.word()) {
            return t.text().codePointCount(0, t.text().length()) + WORD_GAP_WEIGHT;
        }
        return t.text().matches("(?s).*[.!?…。！？\\n].*") ? SENTENCE_PAUSE_WEIGHT : 0.3;
    }

    private static List<WordTiming> spread(List<Token> words, long startMs, long endMs) {
        double total = 0;
        for (Token t : words) {
            total += t.text().length() + WORD_GAP_WEIGHT;
        }
        List<WordTiming> out = new ArrayList<>();
        double cursor = 0;
        long span = Math.max(0, endMs - startMs);
        for (Token t : words) {
            long s = startMs + Math.round(cursor / total * span);
            cursor += t.text().length() + WORD_GAP_WEIGHT;
            out.add(new WordTiming(t.index(), s, startMs + Math.round(cursor / total * span)));
        }
        return out;
    }

    private static Map<Integer, List<Token>> groupWordsBySentence(List<Token> tokens) {
        Map<Integer, List<Token>> out = new TreeMap<>();
        for (Token t : tokens) {
            if (t.word()) {
                out.computeIfAbsent(t.sentence(), k -> new ArrayList<>()).add(t);
            }
        }
        return out;
    }

    private static int[] charOffsets(List<Token> tokens) {
        int[] offsets = new int[tokens.size()];
        int pos = 0;
        for (Token t : tokens) {
            offsets[t.index()] = pos;
            pos += t.text().length();
        }
        return offsets;
    }
}
