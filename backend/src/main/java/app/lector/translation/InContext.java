package app.lector.translation;

import java.util.Optional;
import java.util.regex.Pattern;

public record InContext(String before, String word, String after) {

    static final int WINDOW = 500;

    private static final String OPEN = "<b>";
    private static final String CLOSE = "</b>";
    private static final Pattern EDGES = Pattern.compile("^[\\p{P}\\p{Z}\\s]+|[\\p{P}\\p{Z}\\s]+$");

    public static Optional<InContext> of(String before, String word, String after) {
        String b = before == null ? "" : before;
        String a = after == null ? "" : after;
        if (b.isBlank() && a.isBlank()) {
            return Optional.empty();
        }
        int budget = Math.max(0, WINDOW - word.length());
        int keepBefore = Math.min(b.length(), Math.max(budget / 2, budget - a.length()));
        int keepAfter = Math.min(a.length(), budget - keepBefore);
        return Optional.of(new InContext(b.substring(b.length() - keepBefore), word, a.substring(0, keepAfter)));
    }

    public static InContext alone(String word) {
        return new InContext("", word, "");
    }

    public String marked() {
        return escape(before) + OPEN + escape(word) + CLOSE + escape(after);
    }

    public static Optional<String> meaning(String answer, String word) {
        if (answer == null) {
            return Optional.empty();
        }
        int open = answer.indexOf(OPEN);
        int close = answer.indexOf(CLOSE);
        if (open < 0 || close < open || answer.indexOf(OPEN, open + 1) >= 0 || answer.indexOf(CLOSE, close + 1) >= 0) {
            return Optional.empty();
        }
        String inside = EDGES.matcher(unescape(answer.substring(open + OPEN.length(), close))).replaceAll("");
        if (inside.isEmpty() || inside.equalsIgnoreCase(word)) {
            return Optional.empty();
        }
        return Optional.of(inside.substring(0, Math.min(inside.length(), 500)));
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String unescape(String s) {
        return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
                .replace("&amp;", "&");
    }
}
