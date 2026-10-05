package app.lector.export;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

class ExportTest {

    @Test
    void csvEscapesQuotesNewlinesAndFormulas() {
        assertThat(CsvExporter.escape("plain")).isEqualTo("plain");
        assertThat(CsvExporter.escape("a, b")).isEqualTo("\"a, b\"");
        assertThat(CsvExporter.escape("say \"hi\"")).isEqualTo("\"say \"\"hi\"\"\"");
        assertThat(CsvExporter.escape("line\nbreak")).isEqualTo("\"line\nbreak\"");
        assertThat(CsvExporter.escape("=HYPERLINK(\"x\")")).startsWith("\"'=");
        assertThat(CsvExporter.escape(null)).isEmpty();
    }

    @Test
    void ankiChecksumIsSha1PrefixOfStrippedField() throws Exception {
        byte[] sha = MessageDigest.getInstance("SHA-1").digest("casa".getBytes(StandardCharsets.UTF_8));
        long expected = Long.parseLong(HexFormat.of().formatHex(sha).substring(0, 8), 16);
        assertThat(AnkiExporter.checksum("casa")).isEqualTo(expected);
        assertThat(AnkiExporter.checksum("<b>casa</b>")).isEqualTo(expected);
    }
}
