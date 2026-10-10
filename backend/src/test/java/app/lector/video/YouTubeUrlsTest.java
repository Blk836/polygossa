package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.common.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class YouTubeUrlsTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ?si=abc&t=10",
            "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "https://www.youtube.com/live/dQw4w9WgXcQ",
            "https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ",
            "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "http://music.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "  https://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ  ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ/"
    })
    void extractsTheVideoId(String url) {
        assertThat(YouTubeUrls.videoId(url)).isEqualTo("dQw4w9WgXcQ");
    }

    @Test
    void keepsDashesAndUnderscoresInIds() {
        assertThat(YouTubeUrls.videoId("https://youtu.be/a-b_c-d_e-f")).isEqualTo("a-b_c-d_e-f");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {
            "https://vimeo.com/12345",
            "https://www.youtube.com/@somechannel",
            "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
            "https://evilyoutube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=short",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQX",
            "https://www.youtube.com/watch?v=dQw4w9WgX!Q",
            "https://www.youtube.com/watch",
            "https://www.youtube.com/watch?vv=dQw4w9WgXcQ",
            "https://www.youtube.com/playlist?list=PL123",
            "https://youtu.be/",
            "https://youtu.be/dQw4w9WgXcQ/extra",
            "https://www.youtube.com/shorts/",
            "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "javascript:alert(1)",
            "not a url",
            "https://www.youtube.com/watch?v=%zz"
    })
    void rejectsAnythingElse(String url) {
        assertThatThrownBy(() -> YouTubeUrls.videoId(url))
                .isInstanceOf(ApiException.class)
                .hasMessage("Not a YouTube video link")
                .extracting(e -> ((ApiException) e).status().value()).isEqualTo(400);
    }

    @Test
    void canonicalWatchUrl() {
        assertThat(YouTubeUrls.watchUrl("dQw4w9WgXcQ")).isEqualTo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }

    @Test
    void thumbnailUrl() {
        assertThat(YouTubeUrls.thumbnailUrl("dQw4w9WgXcQ")).isEqualTo("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    }
}
