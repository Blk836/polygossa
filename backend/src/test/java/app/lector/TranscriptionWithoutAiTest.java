package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import app.lector.video.YouTubeStub;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@YouTubeApiTest
class TranscriptionWithoutAiTest {

    private static final String VIDEO = "EEEEEEEEEEE";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;

    @BeforeEach
    void setUp() {
        YouTubeApiTest.STUB.add(VIDEO, new YouTubeStub.Video("Noticias", 200, 600, Map.of()));
        api = new TestApi(mvc, json);
    }

    @Test
    void transcriptionAnswersThatItIsSwitchedOff() throws Exception {
        JsonNode quote = api.send(MockMvcRequestBuilders.post("/api/curator/transcriptions/quote")
                .contentType(MediaType.APPLICATION_JSON).header(CuratedVideoImportApiTest.HEADER, YouTubeApiTest.CURATOR_TOKEN)
                .content("{\"url\":\"https://youtu.be/" + VIDEO + "\",\"language\":\"es\"}"), null, 503);
        assertThat(quote.get("code").asString()).isEqualTo("transcription_off");
        JsonNode sent = api.send(multipart("/api/curator/transcriptions")
                .file(new MockMultipartFile("audio", "audio.webm", "audio/webm", new byte[] {1, 2, 3}))
                .param("url", "https://youtu.be/" + VIDEO).param("language", "es")
                .header(CuratedVideoImportApiTest.HEADER, YouTubeApiTest.CURATOR_TOKEN), null, 503);
        assertThat(sent.get("code").asString()).isEqualTo("transcription_off");
    }
}
