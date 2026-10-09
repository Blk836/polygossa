package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.user.LibraryAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class CuratorDisabledTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    LibraryAccount library;

    @Test
    void everyCuratorRequestIsNotFound() throws Exception {
        TestApi api = new TestApi(mvc, json);
        String learner = api.signup();
        for (String token : new String[] {"", "anything"}) {
            api.send(MockMvcRequestBuilders.post("/api/curator/videos").contentType(MediaType.APPLICATION_JSON)
                    .header(CuratedVideoImportApiTest.HEADER, token)
                    .content(CuratedVideoImportApiTest.body("https://youtu.be/AAAAAAAAAAA", "fr", null, false)), null, 404);
            api.send(MockMvcRequestBuilders.get("/api/curator/options").header(CuratedVideoImportApiTest.HEADER, token),
                    null, 404);
            api.send(MockMvcRequestBuilders.get("/api/curator/videos/AAAAAAAAAAA/copy").param("language", "fr")
                    .header(CuratedVideoImportApiTest.HEADER, token), null, 404);
            api.send(MockMvcRequestBuilders.post("/api/curator/playlists").contentType(MediaType.APPLICATION_JSON)
                    .header(CuratedVideoImportApiTest.HEADER, token)
                    .content("{\"title\":\"T\",\"language\":\"fr\",\"videoIds\":[\"AAAAAAAAAAA\"]}"), null, 404);
            api.send(MockMvcRequestBuilders.post("/api/curator/copies").contentType(MediaType.APPLICATION_JSON)
                    .header(CuratedVideoImportApiTest.HEADER, token)
                    .content("{\"videoId\":\"AAAAAAAAAAA\",\"language\":\"fr\",\"title\":\"T\",\"content\":\"Bonjour.\"}"),
                    null, 404);
        }
        api.send(MockMvcRequestBuilders.get("/api/curator/options"), learner, 404);
        assertThat(library.find()).isEmpty();
    }
}
