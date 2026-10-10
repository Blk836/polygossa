package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.video.CaptionParser.PlayerInfo;
import app.lector.writing.MutableClock;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class YouTubeClientCacheTest {

    private static final String ID = "abcdefghijk";
    private static final Duration TTL = Duration.ofMinutes(10);

    private static YouTubeStub stub;
    private final MutableClock clock = new MutableClock();
    private YouTubeClient client;

    @BeforeAll
    static void start() throws Exception {
        stub = new YouTubeStub();
    }

    @AfterAll
    static void stop() {
        stub.close();
    }

    @BeforeEach
    void reset() {
        stub.reset();
        client = new YouTubeClient(stub.baseUrl(), Duration.ofSeconds(5), TTL, clock);
    }

    private static YouTubeStub.Video video(String title) {
        return new YouTubeStub.Video(title, 200, 95, Map.of("fr", YouTubeStub.srv3("0|1000|Bonjour")));
    }

    private long calls(String path) {
        return stub.requests().stream().filter(r -> r.startsWith(path)).count();
    }

    @Test
    void anAnswerIsReusedWithinTheCacheTime() {
        stub.add(ID, video("Premier"));
        assertThat(client.metadata(ID)).get().extracting(YouTubeClient.Metadata::title).isEqualTo("Premier");
        PlayerInfo first = client.player(ID);
        assertThat(first.durationSeconds()).isEqualTo(95);
        stub.add(ID, video("Changé"));
        clock.advance(TTL.minusSeconds(1));
        assertThat(client.metadata(ID)).get().extracting(YouTubeClient.Metadata::title).isEqualTo("Premier");
        assertThat(client.player(ID)).isEqualTo(first);
        assertThat(calls("/oembed")).isEqualTo(1);
        assertThat(calls("/watch")).isEqualTo(1);
        assertThat(calls("/youtubei/v1/player")).isEqualTo(1);
    }

    @Test
    void answersExpire() {
        stub.add(ID, video("Premier"));
        client.metadata(ID);
        client.player(ID);
        stub.add(ID, video("Changé"));
        clock.advance(TTL);
        assertThat(client.metadata(ID)).get().extracting(YouTubeClient.Metadata::title).isEqualTo("Changé");
        client.player(ID);
        assertThat(calls("/oembed")).isEqualTo(2);
        assertThat(calls("/watch")).isEqualTo(2);
    }

    @Test
    void failuresAreNotReused() {
        stub.setDown(true);
        assertThat(client.metadata(ID)).isEmpty();
        assertThat(client.player(ID)).isEqualTo(CaptionParser.NONE);
        stub.setDown(false);
        stub.add(ID, video("Revenu"));
        assertThat(client.metadata(ID)).get().extracting(YouTubeClient.Metadata::title).isEqualTo("Revenu");
        assertThat(client.player(ID).durationSeconds()).isEqualTo(95);
    }

    @Test
    void eachVideoHasItsOwnAnswer() {
        stub.add(ID, video("Un"));
        stub.add("zyxwvutsrqp", video("Deux"));
        assertThat(client.metadata(ID)).get().extracting(YouTubeClient.Metadata::title).isEqualTo("Un");
        assertThat(client.metadata("zyxwvutsrqp")).get().extracting(YouTubeClient.Metadata::title).isEqualTo("Deux");
    }

    @Test
    void aZeroCacheTimeAsksEveryTime() {
        client = new YouTubeClient(stub.baseUrl(), Duration.ofSeconds(5), Duration.ZERO, clock);
        stub.add(ID, video("Premier"));
        client.metadata(ID);
        client.metadata(ID);
        client.player(ID);
        client.player(ID);
        assertThat(calls("/oembed")).isEqualTo(2);
        assertThat(calls("/watch")).isEqualTo(2);
    }
}
