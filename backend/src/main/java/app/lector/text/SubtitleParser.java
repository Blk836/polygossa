package app.lector.text;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses SRT and WebVTT subtitle files into timed cues. */
public final class SubtitleParser {

    /**
     * A subtitle cue; {@code charStart}/{@code charEnd} locate its text within the joined content. {@code words} are
     * per-word start times when the source has them (YouTube's srv3 captions), else empty.
     */
    public record Cue(long startMs, long endMs, String text, int charStart, int charEnd, List<WordMark> words) {

        public Cue {
            words = words == null ? List.of() : List.copyOf(words); // null: cues stored before word marks existed
        }

        public Cue(long startMs, long endMs, String text, int charStart, int charEnd) {
            this(startMs, endMs, text, charStart, charEnd, List.of());
        }
    }

    /** A word starting at {@code offset} within its cue's text is spoken from {@code startMs}. */
    public record WordMark(int offset, long startMs) {}

    public record Parsed(String content, List<Cue> cues) {}

    private static final Pattern TIMING = Pattern.compile(
            "((?:\\d+:)?\\d{1,2}:\\d{2}[.,]\\d{1,3})\\s*-->\\s*((?:\\d+:)?\\d{1,2}:\\d{2}[.,]\\d{1,3})");
    private static final Pattern TAGS = Pattern.compile("<[^>]+>|\\{\\\\[^}]*}");

    private SubtitleParser() {}

    public static Parsed parse(String raw) {
        String[] lines = raw.replace("\uFEFF", "").replace("\r\n", "\n").replace('\r', '\n').split("\n");
        List<Cue> found = new ArrayList<>();
        int i = 0;
        while (i < lines.length) {
            Matcher m = TIMING.matcher(lines[i]);
            i++;
            if (m.find()) {
                int textEnd = endOfCueText(lines, i);
                String text = cueText(lines, i, textEnd);
                if (!text.isEmpty()) {
                    found.add(new Cue(toMillis(m.group(1)), toMillis(m.group(2)), text, 0, 0));
                }
                i = textEnd;
            }
        }
        if (found.isEmpty()) {
            throw new IllegalArgumentException("No subtitle cues found; expected an .srt or .vtt file");
        }
        return join(found);
    }

    /** A cue's text runs until a blank line or the next timing line. */
    private static int endOfCueText(String[] lines, int from) {
        int i = from;
        while (i < lines.length && !lines[i].isBlank() && !TIMING.matcher(lines[i]).find()) {
            i++;
        }
        return i;
    }

    private static String cueText(String[] lines, int from, int to) {
        List<String> parts = new ArrayList<>();
        for (int i = from; i < to; i++) {
            String clean = TAGS.matcher(lines[i]).replaceAll("").trim();
            if (!clean.isEmpty()) {
                parts.add(clean);
            }
        }
        return String.join(" ", parts);
    }

    /** Joins cue texts with line breaks and records where each cue sits in the joined content. */
    public static Parsed join(List<Cue> cues) {
        StringBuilder content = new StringBuilder();
        List<Cue> placed = new ArrayList<>();
        for (Cue cue : cues) {
            if (content.length() > 0) {
                content.append('\n');
            }
            int charStart = content.length();
            content.append(cue.text());
            placed.add(new Cue(cue.startMs(), cue.endMs(), cue.text(), charStart, content.length(), cue.words()));
        }
        return new Parsed(content.toString(), placed);
    }

    static long toMillis(String timestamp) {
        String[] parts = timestamp.replace(',', '.').split(":");
        long hours = parts.length == 3 ? Long.parseLong(parts[0]) : 0;
        long minutes = Long.parseLong(parts[parts.length - 2]);
        String[] secParts = parts[parts.length - 1].split("\\.");
        long seconds = Long.parseLong(secParts[0]);
        String frac = secParts.length > 1 ? (secParts[1] + "00").substring(0, 3) : "000";
        return ((hours * 60 + minutes) * 60 + seconds) * 1000 + Long.parseLong(frac);
    }
}
