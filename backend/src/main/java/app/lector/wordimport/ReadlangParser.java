package app.lector.wordimport;

import app.lector.common.ApiException;
import app.lector.vocab.ImportedWord;
import app.lector.vocab.WordStatus;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Reads a word list exported from Readlang. Its export has changed over the years, so this is lenient: comma, tab,
 * semicolon or pipe separated, quoted fields, an optional header row naming the columns in any order (word,
 * translation, context), else the columns word, translation, context. Every word comes in as learning.
 */
final class ReadlangParser {

    static final String NO_WORDS = "This file has no words in it. Export your words from Readlang and upload that file.";

    private static final char[] DELIMITERS = {'\t', ',', ';', '|'};
    private static final Set<String> WORD_HEADERS = Set.of("word", "words", "phrase", "term", "expression", "front");

    /** Column positions; -1 when the file has no such column. */
    private record Columns(int word, int translation, int context) {
        static final Columns DEFAULT = new Columns(0, 1, 2);
    }

    private ReadlangParser() {}

    static List<ImportedWord> parse(String content) {
        String text = content.startsWith("﻿") ? content.substring(1) : content;
        List<List<String>> rows = rows(text, delimiter(firstLine(text)));
        Columns columns = rows.isEmpty() ? Columns.DEFAULT : header(rows.getFirst());
        List<ImportedWord> words = new ArrayList<>();
        for (int i = columns == Columns.DEFAULT ? 0 : 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String word = cell(row, columns.word());
            if (word != null) {
                words.add(new ImportedWord(word, WordStatus.LEARNING, cell(row, columns.translation()),
                        cell(row, columns.context())));
            }
        }
        if (words.isEmpty()) {
            throw ApiException.badRequest(NO_WORDS);
        }
        return words;
    }

    private static String firstLine(String text) {
        for (String line : text.split("\\R")) {
            if (!line.isBlank()) {
                return line;
            }
        }
        return "";
    }

    /** The separator used most outside quotes on the first line (tab, then comma, on a tie); comma by default. */
    static char delimiter(String line) {
        int[] counts = counts(line);
        int best = 1;
        for (int d = 0; d < DELIMITERS.length; d++) {
            if (counts[d] > counts[best] || counts[d] == counts[best] && d < best && counts[d] > 0) {
                best = d;
            }
        }
        return DELIMITERS[best];
    }

    /** How often each of {@link #DELIMITERS} appears outside quotes. */
    private static int[] counts(String line) {
        int[] counts = new int[DELIMITERS.length];
        boolean quoted = false;
        for (char c : line.toCharArray()) {
            if (c == '"') {
                quoted = !quoted;
            }
            for (int d = 0; d < DELIMITERS.length && !quoted; d++) {
                counts[d] += c == DELIMITERS[d] ? 1 : 0;
            }
        }
        return counts;
    }

    /** The columns a header row names, or {@link Columns#DEFAULT} when the first row isn't a header. */
    private static Columns header(List<String> first) {
        int[] columns = {-1, -1, -1};
        for (int i = 0; i < first.size(); i++) {
            int kind = kind(first.get(i).strip().toLowerCase(Locale.ROOT));
            if (kind >= 0 && columns[kind] < 0) {
                columns[kind] = i;
            }
        }
        return columns[0] < 0 ? Columns.DEFAULT : new Columns(columns[0], columns[1], columns[2]);
    }

    /** What a header names: 0 the word, 1 its translation, 2 its context; -1 anything else. */
    private static int kind(String name) {
        if (WORD_HEADERS.contains(name)) {
            return 0;
        }
        if (isTranslation(name)) {
            return 1;
        }
        return name.contains("context") || name.contains("sentence") || name.contains("example") ? 2 : -1;
    }

    private static boolean isTranslation(String name) {
        return name.contains("translation") || name.contains("meaning") || name.contains("definition")
                || name.equals("back");
    }

    private static String cell(List<String> row, int column) {
        if (column < 0 || column >= row.size()) {
            return null;
        }
        String value = row.get(column).strip();
        return value.isEmpty() ? null : value;
    }

    /** RFC 4180 rows: quoted fields may hold the delimiter, newlines and doubled quotes; blank lines are dropped. */
    private static List<List<String>> rows(String text, char delimiter) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c != '"') {
                    field.append(c);
                } else if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                    field.append('"');
                    i++;
                } else {
                    quoted = false;
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == delimiter) {
                row.add(field.toString());
                field.setLength(0);
            } else if (c == '\n' || c == '\r') {
                endRow(rows, row, field);
                row = new ArrayList<>();
            } else {
                field.append(c);
            }
        }
        endRow(rows, row, field);
        return rows;
    }

    private static void endRow(List<List<String>> rows, List<String> row, StringBuilder field) {
        row.add(field.toString());
        field.setLength(0);
        if (row.stream().anyMatch(f -> !f.isBlank())) {
            rows.add(row);
        }
    }
}
