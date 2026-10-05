package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.common.ApiException;
import app.lector.text.SubtitleParser.Cue;
import app.lector.video.CaptionParser.PlayerInfo;
import app.lector.video.CaptionParser.Track;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** YouTubeClient against a local stub of youtube.com. */
class YouTubeClientTest {

    private static YouTubeStub stub;
    private static YouTubeClient client;

    @BeforeAll
    static void start() throws Exception {
        stub = new YouTubeStub();
        client = new YouTubeClient(stub.baseUrl(), Duration.ofSeconds(5));
    }

    @AfterAll
    static void stop() {
        stub.close();
    }

    @BeforeEach
    void reset() {
        stub.reset();
    }

    @Test
    void readsTitleAndThumbnailFromOembed() {
        stub.add("aaaaaaaaaaa", YouTubeStub.Video.withCaptions("Mi vídeo", 60, "es", YouTubeStub.srv3("0|1000|Hola")));
        assertThat(client.metadata("aaaaaaaaaaa"))
                .contains(new YouTubeClient.Metadata("Mi vídeo", "https://i.ytimg.com/x.jpg"));
        assertThat(stub.requests()).anyMatch(r -> r.startsWith("/oembed?") && r.contains("format=json")
                && r.contains("watch%3Fv%3Daaaaaaaaaaa"));
    }

    @ParameterizedTest
    @ValueSource(ints = {401, 403, 404})
    void unavailableVideosAreRejected(int status) {
        stub.add("bbbbbbbbbbb", new YouTubeStub.Video("x", status, null, Map.of()));
        assertThatThrownBy(() -> client.metadata("bbbbbbbbbbb"))
                .isInstanceOf(ApiException.class)
                .hasMessage("This video is private, removed, or can't be embedded")
                .extracting(e -> ((ApiException) e).status().value()).isEqualTo(422);
    }

    @Test
    void unknownIdsAreRejected() {
        // YouTube answers 400 for ids that don't exist.
        assertThatThrownBy(() -> client.metadata("ccccccccccc")).isInstanceOf(ApiException.class);
    }

    @Test
    void unreachableYouTubeMeansNoMetadata() {
        stub.setDown(true);
        assertThat(client.metadata("aaaaaaaaaaa")).isEmpty();
        YouTubeClient nowhere = new YouTubeClient("http://127.0.0.1:1", Duration.ofSeconds(2));
        assertThat(nowhere.metadata("aaaaaaaaaaa")).isEmpty();
    }

    @Test
    void readsPlayerInfoThroughTheWatchPageKey() {
        stub.add("aaaaaaaaaaa", YouTubeStub.Video.withCaptions("v", 95, "es", YouTubeStub.srv3("0|1000|Hola")));
        PlayerInfo info = client.player("aaaaaaaaaaa");
        assertThat(info.durationSeconds()).isEqualTo(95);
        assertThat(info.tracks()).containsExactly(
                new Track(stub.baseUrl() + "/api/timedtext?v=aaaaaaaaaaa&lang=es", "es", false));
        assertThat(stub.requests()).contains("/watch?v=aaaaaaaaaaa");
    }

    @Test
    void invalidIdsAreNeverSentToYouTube() {
        assertThat(client.player("bad\"id")).isEqualTo(new PlayerInfo(null, java.util.List.of()));
        assertThat(stub.requests()).isEmpty();
    }

    @Test
    void playerFailuresYieldEmptyInfo() {
        assertThat(client.player("zzzzzzzzzzz")).isEqualTo(new PlayerInfo(null, java.util.List.of()));
        stub.setDown(true);
        assertThat(client.player("aaaaaaaaaaa")).isEqualTo(new PlayerInfo(null, java.util.List.of()));
    }

    @Test
    void downloadsAndParsesACaptionTrack() {
        stub.add("aaaaaaaaaaa", YouTubeStub.Video.withCaptions("v", 95, "es",
                YouTubeStub.srv3("0|1000|Hola", "1500|500|mundo")));
        Track track = client.player("aaaaaaaaaaa").tracks().getFirst();
        assertThat(client.captions(track)).containsExactly(new Cue(0, 1000, "Hola", 0, 0), new Cue(1500, 2000, "mundo", 0, 0));
    }

    @Test
    void asksForSrv3CaptionsWhichCarryWordTimings() {
        stub.add("aaaaaaaaaaa", YouTubeStub.Video.withCaptions("v", 95, "es", YouTubeStub.srv3("0|1000|Hola")));
        Track track = client.player("aaaaaaaaaaa").tracks().getFirst();
        client.captions(new Track(track.baseUrl() + "&fmt=vtt", "es", false));
        assertThat(stub.requests()).filteredOn(r -> r.startsWith("/api/timedtext"))
                .containsExactly("/api/timedtext?v=aaaaaaaaaaa&lang=es&fmt=srv3");
    }

    @Test
    void refusesCaptionUrlsOnOtherHosts() {
        stub.add("aaaaaaaaaaa", YouTubeStub.Video.withCaptions("v", 95, "es", YouTubeStub.srv3("0|1000|Hola")));
        String foreign = stub.baseUrl().replace("127.0.0.1", "localhost") + "/api/timedtext?v=aaaaaaaaaaa&lang=es";
        assertThat(client.captions(new Track(foreign, "es", false))).isEmpty();
        assertThat(client.captions(new Track("not a url", "es", false))).isEmpty();
        assertThat(stub.requests()).noneMatch(r -> r.startsWith("/api/timedtext"));
    }

    @Test
    void captionFetchFailuresYieldNothing() {
        Track missing = new Track(stub.baseUrl() + "/api/timedtext?v=nope&lang=es", "es", false);
        assertThat(client.captions(missing)).isEmpty();
    }
}
