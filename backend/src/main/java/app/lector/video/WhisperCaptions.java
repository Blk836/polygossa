package app.lector.video;

import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Language;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import tools.jackson.databind.JsonNode;

public final class WhisperCaptions {

    public record Heard(List<Cue> cues, long audioSeconds, String problem) {}

    static final String NO_SPEECH = "no speech found";
    private static final double NOT_SPEECH = 0.6;
    private static final long EARLY_MS = 100;

    private WhisperCaptions() {}

    public static Heard read(JsonNode heard, Language language) {
        long seconds = (long) Math.ceil(heard.path("duration").asDouble(0));
        String spoken = heard.path("language").asString("").strip();
        if (!spoken.isEmpty() && !sameLanguage(spoken, language)) {
            return new Heard(List.of(), seconds, "the speech is " + capitalised(spoken) + ", not "
                    + language.displayName());
        }
        List<Cue> segments = segments(heard.path("segments"));
        if (segments.isEmpty()) {
            return new Heard(List.of(), seconds, NO_SPEECH);
        }
        return new Heard(marked(segments, heard.path("words")), seconds, null);
    }

    private static boolean sameLanguage(String spoken, Language language) {
        return spoken.equalsIgnoreCase(language.displayName()) || spoken.equalsIgnoreCase(language.code());
    }

    private static String capitalised(String name) {
        return name.substring(0, 1).toUpperCase(Locale.ROOT) + name.substring(1);
    }

    private static List<Cue> segments(JsonNode segments) {
        List<Cue> out = new ArrayList<>();
        for (JsonNode segment : segments) {
            String text = segment.path("text").asString("").strip();
            if (!text.isEmpty() && segment.path("no_speech_prob").asDouble(0) < NOT_SPEECH) {
                out.add(new Cue(millis(segment.path("start")), millis(segment.path("end")), text, 0, 0));
            }
        }
        return out;
    }

    private static List<Cue> marked(List<Cue> segments, JsonNode words) {
        List<List<WordMark>> marks = new ArrayList<>();
        segments.forEach(s -> marks.add(new ArrayList<>()));
        int seg = 0;
        int at = 0;
        for (JsonNode word : words) {
            String w = word.path("word").asString("").strip();
            long ms = millis(word.path("start"));
            while (seg + 1 < segments.size() && ms >= segments.get(seg + 1).startMs() - EARLY_MS) {
                seg++;
                at = 0;
            }
            int found = w.isEmpty() ? -1 : indexIgnoringCase(segments.get(seg).text(), w, at);
            if (found >= 0) {
                marks.get(seg).add(new WordMark(found, ms));
                at = found + w.length();
            }
        }
        List<Cue> out = new ArrayList<>();
        for (int i = 0; i < segments.size(); i++) {
            Cue s = segments.get(i);
            out.add(new Cue(s.startMs(), s.endMs(), s.text(), 0, 0, marks.get(i)));
        }
        return out;
    }

    private static int indexIgnoringCase(String text, String word, int from) {
        for (int i = from; i + word.length() <= text.length(); i++) {
            if (text.regionMatches(true, i, word, 0, word.length())) {
                return i;
            }
        }
        return -1;
    }

    private static long millis(JsonNode seconds) {
        return Math.round(seconds.asDouble(0) * 1000);
    }
}
