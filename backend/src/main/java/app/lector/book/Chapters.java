package app.lector.book;

import java.util.ArrayList;
import java.util.List;

final class Chapters {

    private Chapters() {}

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
