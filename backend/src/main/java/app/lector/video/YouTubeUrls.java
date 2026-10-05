package app.lector.video;

import app.lector.common.ApiException;
import app.lector.text.VideoViews;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Recognizes YouTube video links and extracts the 11-character video id. */
public final class YouTubeUrls {

    public static final Pattern VIDEO_ID = Pattern.compile("[A-Za-z0-9_-]{11}");

    private static final String NOT_YOUTUBE = "Not a YouTube video link";
    private static final Set<String> HOSTS = Set.of("youtube.com", "www.youtube.com", "m.youtube.com",
            "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com");
    /** Path forms like /shorts/{id} and /embed/{id}. */
    private static final Set<String> ID_PATHS = Set.of("shorts", "embed", "live", "v");

    private YouTubeUrls() {}

    /** The video id in {@code url}; throws 400 "Not a YouTube video link" for anything else. */
    public static String videoId(String url) {
        URI uri = parse(url);
        String id = uri == null ? null : idFrom(uri);
        if (id == null || !VIDEO_ID.matcher(id).matches()) {
            throw ApiException.badRequest(NOT_YOUTUBE);
        }
        return id;
    }

    public static String watchUrl(String videoId) {
        return "https://www.youtube.com/watch?v=" + videoId;
    }

    public static String thumbnailUrl(String videoId) {
        return VideoViews.thumbnailUrl(videoId);
    }

    private static String idFrom(URI uri) {
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        String path = uri.getPath() == null ? "" : uri.getPath().replaceAll("^/+|/+$", "");
        String[] segments = path.split("/");
        if (host.equals("youtu.be")) {
            return segments.length == 1 ? segments[0] : null;
        }
        if (!HOSTS.contains(host)) {
            return null;
        }
        if (segments.length == 1 && segments[0].equals("watch")) {
            return queryParam(uri.getRawQuery(), "v");
        }
        return segments.length == 2 && ID_PATHS.contains(segments[0]) ? segments[1] : null;
    }

    private static String queryParam(String query, String name) {
        if (query == null) {
            return null;
        }
        for (String pair : query.split("&")) {
            if (pair.startsWith(name + "=")) {
                return pair.substring(name.length() + 1);
            }
        }
        return null;
    }

    private static URI parse(String url) {
        if (url == null) {
            return null;
        }
        try {
            URI uri = new URI(url.strip());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            boolean web = scheme.equals("http") || scheme.equals("https");
            return web && uri.getHost() != null ? uri : null;
        } catch (URISyntaxException e) {
            return null;
        }
    }
}
