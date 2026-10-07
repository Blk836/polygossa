package app.lector.book;

import java.util.ArrayList;
import java.util.List;

/** Cutting long chapters into parts that fit a text, at paragraph boundaries where possible. */
final class Chapters {

    private Chapters() {}

    /** The chapter as is, or "title (1)", "title (2)", … when it is longer than {@code max} characters. */
    static List<Book.Chapter> split(String title, String content, int max) {
        List<String> parts = pack(content, max);
        if (parts.size() == 1) {
            return List.of(new Book.Chapter(title, parts.getFirst()));
        }
        List<Book.Chapter> out = new ArrayList<>();
        for (int i = 0; i < parts.size(); i++) {
            out.add(new Book.Chapter(title + " (" + (i + 1) + ")", parts.get(i)));
        }
        return out;
    }

    /**
     * Packs paragraphs (separated by blank lines) into parts of at most {@code max} characters. A paragraph too long
     * for one part is cut at line breaks, and a line too long at the last space before the limit.
     */
    static List<String> pack(String content, int max) {
        List<String> units = new ArrayList<>();
        for (String paragraph : content.strip().split("\\n\\s*\\n")) {
            units.addAll(cut(paragraph.strip(), max));
        }
        List<String> parts = new ArrayList<>();
        StringBuilder part = new StringBuilder();
        for (String unit : units) {
            if (!part.isEmpty() && part.length() + 2 + unit.length() > max) {
                parts.add(part.toString());
                part.setLength(0);
            }
            part.append(part.isEmpty() ? "" : "\n\n").append(unit);
        }
        if (!part.isEmpty()) {
            parts.add(part.toString());
        }
        return parts;
    }

    /** A unit that fits, else its lines, else pieces cut at spaces. */
    private static List<String> cut(String text, int max) {
        if (text.length() <= max) {
            return List.of(text);
        }
        List<String> out = new ArrayList<>();
        String rest = text;
        while (rest.length() > max) {
            int at = rest.lastIndexOf('\n', max);
            if (at <= 0) {
                at = rest.lastIndexOf(' ', max);
            }
            if (at <= 0) {
                at = max;
            }
            out.add(rest.substring(0, at).strip());
            rest = rest.substring(at).strip();
        }
        if (!rest.isEmpty()) {
            out.add(rest);
        }
        return out;
    }
}
