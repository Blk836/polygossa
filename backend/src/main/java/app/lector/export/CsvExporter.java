package app.lector.export;

import app.lector.vocab.VocabularyEntry;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** RFC 4180 CSV export of a vocabulary list. */
public final class CsvExporter {

    private static final String[] HEADER = {"term", "display", "language", "kind", "status", "definition",
            "part_of_speech", "pronunciation", "example", "context", "source", "created_at"};

    private CsvExporter() {}

    public static byte[] export(List<VocabularyEntry> entries) {
        StringBuilder sb = new StringBuilder("﻿"); // BOM so spreadsheet apps detect UTF-8
        row(sb, HEADER);
        for (VocabularyEntry e : entries) {
            row(sb, e.getTerm(), e.getDisplayTerm(), e.getLanguage().code(), e.getKind().json(), e.getStatus().json(),
                    e.getDefinition(), e.getPartOfSpeech(), e.getPronunciation(), e.getExample(),
                    e.getContextSentence(), e.getSourceText() == null ? null : e.getSourceText().getTitle(),
                    e.getCreatedAt().toString());
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void row(StringBuilder sb, String... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(escape(cells[i]));
        }
        sb.append("\r\n");
    }

    static String escape(String value) {
        if (value == null) {
            return "";
        }
        String v = value;
        // Neutralize spreadsheet formula injection.
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
