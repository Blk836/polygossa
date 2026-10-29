package app.lector.translation;

import java.util.Optional;

public record InContext(String before, String word, String after) {

    static final int WINDOW = 500;

    private static final String OPEN = "<b>";
    private static final String CLOSE = "</b>";

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

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
