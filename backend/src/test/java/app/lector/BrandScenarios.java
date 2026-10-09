package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.lector.seed.SampleContentSeeder;
import app.lector.user.User;
import app.lector.user.UserRepository;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@AutoConfigureMockMvc
abstract class BrandScenarios {

    abstract String brand();

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    UserRepository users;

    @Autowired
    SampleContentSeeder contentSeeder;

    private List<Long> starterIds(TestApi api, String viewer) throws Exception {
        List<Long> ids = new ArrayList<>();
        for (JsonNode item : api.get(viewer, "/api/library?kind=text&size=50", 200).get("items")) {
            assertThat(item.get("owner").get("displayName").asString()).isEqualTo(brand() + " Library");
            ids.add(item.get("id").asLong());
        }
        return ids;
    }

    @Test
    void starterLibraryIsOwnedByTheBrandLibraryAndAnOldNameIsRenamedOnStart() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String viewer = api.signup();
        List<Long> fresh = starterIds(api, viewer);
        assertThat(fresh).hasSize(6);

        User library = users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL).orElseThrow();
        library.setDisplayName("Lector Library");
        users.save(library);

        contentSeeder.run(null);

        assertThat(users.findByEmailIgnoreCase(SampleContentSeeder.LIBRARY_EMAIL).orElseThrow().getDisplayName())
                .isEqualTo(brand() + " Library");
        assertThat(starterIds(api, viewer)).containsExactlyInAnyOrderElementsOf(fresh);
    }

    private record Deck(String name, String description, String noteType, String tags) {}

    private Deck exportAnki(String token, String query) throws Exception {
        byte[] apkg = mvc.perform(MockMvcRequestBuilders.get("/api/vocabulary/export.apkg" + query)
                        .header("Authorization", token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        Path db = Files.createTempFile("branding", ".anki2");
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(apkg))) {
            for (ZipEntry e = zip.getNextEntry(); e != null; e = zip.getNextEntry()) {
                if (e.getName().equals("collection.anki2")) {
                    Files.write(db, zip.readAllBytes());
                }
            }
        }
        try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + db.toAbsolutePath());
             Statement st = conn.createStatement()) {
            ResultSet col = st.executeQuery("SELECT decks, models FROM col");
            col.next();
            JsonNode deck = null;
            for (JsonNode d : json.readTree(col.getString("decks"))) {
                if (d.get("id").asLong() != 1) {
                    deck = d;
                }
            }
            String noteType = json.readTree(col.getString("models")).iterator().next().get("name").asString();
            ResultSet note = st.executeQuery("SELECT tags FROM notes");
            note.next();
            return new Deck(deck.get("name").asString(), deck.get("desc").asString(), noteType, note.getString(1));
        } finally {
            Files.deleteIfExists(db);
        }
    }

    @Test
    void ankiExportIsNamedAfterTheBrandButKeepsTheLectorTagForEarlierImports() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String token = api.signup();
        api.post(token, "/api/vocabulary", "{\"language\":\"es\",\"term\":\"gato\"}", 201);

        Deck all = exportAnki(token, "");
        assertThat(all.name()).isEqualTo(brand());
        assertThat(all.description()).isEqualTo("Exported from " + brand());
        assertThat(all.noteType()).isEqualTo(brand() + " Vocabulary");
        assertThat(all.tags()).isEqualTo(" lector es learning ");

        assertThat(exportAnki(token, "?language=es").name()).isEqualTo(brand() + "::Spanish");
    }
}
