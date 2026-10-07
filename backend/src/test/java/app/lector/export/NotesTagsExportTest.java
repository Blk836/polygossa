package app.lector.export;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Language;
import app.lector.user.User;
import app.lector.vocab.EntryKind;
import app.lector.vocab.VocabularyEntry;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** word-notes-tags.feature: notes and tags travel to CSV and Anki. */
class NotesTagsExportTest {

    private static VocabularyEntry perro() {
        VocabularyEntry e = new VocabularyEntry(new User("a@b.co", "x", "A"), Language.ES, "perro", "perro",
                EntryKind.WORD);
        e.setDefinition("dog");
        e.setNote("a dog eating a pear");
        e.setTags(List.of("animals", "a1"));
        return e;
    }

    @Test
    void csvEndsWithNoteAndTags() {
        String[] lines = new String(CsvExporter.export(List.of(perro())), StandardCharsets.UTF_8).split("\r\n");
        assertThat(lines[0]).endsWith(",created_at,note,tags");
        assertThat(lines[1]).endsWith(",a dog eating a pear,animals a1");
    }

    @Test
    void ankiHasANotesFieldOnTheBackAndTheWordsTags() throws Exception {
        byte[] apkg = AnkiExporter.export("Brand", "Brand", List.of(perro()));
        Path db = Files.createTempFile("notes-tags", ".anki2");
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(apkg))) {
            for (ZipEntry z = zip.getNextEntry(); z != null; z = zip.getNextEntry()) {
                if (z.getName().equals("collection.anki2")) {
                    Files.write(db, zip.readAllBytes());
                }
            }
        }
        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + db.toAbsolutePath());
             Statement st = conn.createStatement()) {
            ResultSet col = st.executeQuery("SELECT models FROM col");
            col.next();
            JsonNode model = JsonMapper.builder().build().readTree(col.getString(1)).iterator().next();
            List<String> fields = model.get("flds").valueStream().map(f -> f.get("name").asString()).toList();
            assertThat(fields).contains("Notes");
            assertThat(model.get("tmpls").get(0).get("afmt").asString()).contains("{{Notes}}");
            ResultSet note = st.executeQuery("SELECT tags, flds FROM notes");
            note.next();
            assertThat(note.getString(1)).isEqualTo(" lector es learning animals a1 ");
            assertThat(note.getString(2).split("\u001f")).contains("a dog eating a pear");
        } finally {
            Files.deleteIfExists(db);
        }
    }
}
