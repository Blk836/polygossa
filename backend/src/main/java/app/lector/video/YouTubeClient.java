package app.lector.video;

import app.lector.common.ApiException;
import app.lector.text.SubtitleParser.Cue;
import app.lector.video.CaptionParser.PlayerInfo;
import app.lector.video.CaptionParser.Track;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The only way the backend talks to YouTube. Metadata comes from the official oEmbed endpoint; captions come from
 * the (unofficial) innertube player endpoint, so every caption failure degrades to "no captions" rather than an
 * error, and the user can supply a transcript instead.
 */
@Component
public class YouTubeClient {

    public record Metadata(String title, String thumbnailUrl) {}

    private static final String UNAVAILABLE = "This video is private, removed, or can't be embedded";
    /** oEmbed answers 400 for unknown ids, 401/403 for private or non-embeddable videos, 404 for removed ones. */
    private static final Set<Integer> UNAVAILABLE_STATUSES = Set.of(400, 401, 403, 404);
    private static final String BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            + "(KHTML, like Gecko) Chrome/130.0 Safari/537.36";
    private static final String PLAYER_CLIENT = "{\"context\":{\"client\":{\"clientName\":\"ANDROID\","
            + "\"clientVersion\":\"20.10.38\",\"hl\":\"en\"}},\"videoId\":\"%s\"}";

    private final URI base;
    private final Duration timeout;
    private final HttpClient http;

    @Autowired
    public YouTubeClient(@Value("${app.youtube.base-url:https://www.youtube.com}") String baseUrl,
                         @Value("${app.youtube.timeout:10s}") Duration timeout) {
        this.base = URI.create(baseUrl.replaceAll("/+$", ""));
        this.timeout = timeout;
        this.http = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(timeout)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /** Title and thumbnail; empty when YouTube can't be reached. Throws 422 when the video isn't available. */
    public Optional<Metadata> metadata(String videoId) {
        String watch = URLEncoder.encode(YouTubeUrls.watchUrl(videoId), StandardCharsets.UTF_8);
        Optional<HttpResponse<String>> response = send(get("/oembed?format=json&url=" + watch));
        if (response.isEmpty()) {
            return Optional.empty();
        }
        int status = response.get().statusCode();
        if (UNAVAILABLE_STATUSES.contains(status)) {
            throw ApiException.unprocessable(UNAVAILABLE);
        }
        return status == 200 ? parseOembed(response.get().body()) : Optional.empty();
    }

    /** Video length, caption tracks and YouTube category; {@link CaptionParser#NONE} on any failure. */
    public PlayerInfo player(String videoId) {
        if (!YouTubeUrls.VIDEO_ID.matcher(videoId).matches()) {
            return CaptionParser.NONE;
        }
        Optional<String> watchPage = body(get("/watch?v=" + videoId));
        Optional<String> key = watchPage.flatMap(CaptionParser::apiKey);
        if (key.isEmpty()) {
            return CaptionParser.NONE;
        }
        HttpRequest player = request("/youtubei/v1/player?key=" + key.get())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(PLAYER_CLIENT.formatted(videoId)))
                .build();
        String category = watchPage.flatMap(CaptionParser::youtubeCategory).orElse(null);
        return body(player).map(CaptionParser::parsePlayer).orElse(CaptionParser.NONE).withCategory(category);
    }

    /** The track's cues; empty on failure, or when the track URL isn't on the YouTube host. */
    public List<Cue> captions(Track track) {
        URI uri = parse(CaptionParser.srv3Url(track.baseUrl()));
        if (uri == null || !sameOrigin(uri)) {
            return List.of();
        }
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout).header("User-Agent", BROWSER_UA).GET().build();
        return body(request).map(CaptionParser::parseTimedText).orElse(List.of());
    }

    private static Optional<Metadata> parseOembed(String json) {
        try {
            JsonNode node = JsonMapper.builder().build().readTree(json);
            String title = node.path("title").asString("").strip();
            String thumbnail = node.path("thumbnail_url").asString("");
            return Optional.of(new Metadata(title.isEmpty() ? null : title, thumbnail.isEmpty() ? null : thumbnail));
        } catch (JacksonException e) {
            return Optional.empty();
        }
    }

    private HttpRequest.Builder request(String pathAndQuery) {
        return HttpRequest.newBuilder(URI.create(base + pathAndQuery))
                .timeout(timeout)
                .header("User-Agent", BROWSER_UA)
                .header("Accept-Language", "en-US,en;q=0.8")
                // Skips the EU cookie-consent interstitial that would otherwise replace the watch page.
                .header("Cookie", "CONSENT=YES+cb; SOCS=CAI");
    }

    private HttpRequest get(String pathAndQuery) {
        return request(pathAndQuery).GET().build();
    }

    private Optional<String> body(HttpRequest request) {
        return send(request).filter(r -> r.statusCode() == 200).map(HttpResponse::body);
    }

    private Optional<HttpResponse<String>> send(HttpRequest request) {
        try {
            return Optional.of(http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)));
        } catch (IOException e) {
            return Optional.empty();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        }
    }

    private boolean sameOrigin(URI uri) {
        return Objects.equals(base.getScheme(), uri.getScheme()) && base.getHost().equalsIgnoreCase(uri.getHost())
                && base.getPort() == uri.getPort();
    }

    private static URI parse(String url) {
        try {
            URI uri = new URI(url);
            return uri.getHost() == null ? null : uri;
        } catch (URISyntaxException e) {
            return null;
        }
    }
}
