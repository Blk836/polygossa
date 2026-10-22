package app.lector.export;

import app.lector.vocab.VocabularyDto;
import app.lector.vocab.VocabularyEntry;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class CsvExporter {

    private static final String[] HEADER = {"term", "display", "language", "kind", "status", "definition",
            "part_of_speech", "pronunciation", "example", "context", "source", "times_met", "share_percent",
            "created_at", "note", "tags"};

    private CsvExporter() {}

    public static byte[] export(List<VocabularyEntry> entries) {
        return export(entries, new HashMap<>());
    }

    public static byte[] export(List<VocabularyEntry> entries, Map<Long, VocabularyDto.Met> met) {
        StringBuilder sb = new StringBuilder("﻿");
        row(sb, HEADER);
        for (VocabularyEntry e : entries) {
            row(sb, e.getTerm(), e.getDisplayTerm(), e.getLanguage().code(), e.getKind().json(), e.getStatus().json(),
                    e.getDefinition(), e.getPartOfSpeech(), e.getPronunciation(), e.getExample(),
                    e.getContextSentence(), e.getSourceText() == null ? null : e.getSourceText().getTitle(),
                    times(met.get(e.getId())), percent(met.get(e.getId())), e.getCreatedAt().toString(), e.getNote(),
                    String.join(" ", e.getTags()));
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String times(VocabularyDto.Met met) {
        return met == null ? null : String.valueOf(met.count());
    }

    private static String percent(VocabularyDto.Met met) {
        if (met == null) {
            return null;
        }
        return BigDecimal.valueOf(met.share() * 100).setScale(4, RoundingMode.HALF_UP).stripTrailingZeros()
                .toPlainString();
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
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
