package app.lector.video;

import app.lector.common.ApiException;
import app.lector.text.AudioAligner;
import app.lector.text.Category;
import app.lector.text.ContentLimit;
import app.lector.text.ContentReview;
import app.lector.text.SubtitleParser;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.video.CaptionParser.PlayerInfo;
import app.lector.video.CaptionParser.Track;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

@Service
public class VideoImportService {

    public record VideoImport(String url, Language language, String title, boolean isPublic, MultipartFile file,
                              String transcript, Category category) {}

    public record VideoCopy(String videoId, Language language, String title, Category category,
                            Integer durationSeconds, String content, List<Cue> cues) {}

    private record Transcript(String content, List<Cue> cues) {}

    private final TextService texts;
    private final PlanService plans;
    private final YouTubeClient youtube;
    private final ObjectMapper json;
    private final ContentReview review;
    private final TranscriptTidy tidy;

    public VideoImportService(TextService texts, PlanService plans, YouTubeClient youtube, ObjectMapper json,
                              ContentReview review, TranscriptTidy tidy) {
        this.texts = texts;
        this.plans = plans;
        this.youtube = youtube;
        this.json = json;
        this.review = review;
        this.tidy = tidy;
    }

    public Text importVideo(User owner, VideoImport req) {
        String videoId = YouTubeUrls.videoId(req.url());
        plans.checkCanImportText(owner);
        return save(owner, videoId, req);
    }

    public Text importForLibrary(User library, VideoImport req) {
        return save(library, YouTubeUrls.videoId(req.url()), req);
    }

    private Text save(User owner, String videoId, VideoImport req) {
        Optional<YouTubeClient.Metadata> meta = youtube.metadata(videoId);
        PlayerInfo player = youtube.player(videoId);
        Transcript transcript = transcript(req, player);
        String title = orElse(req.title(), orElse(meta.map(YouTubeClient.Metadata::title).orElse(null),
                "YouTube video " + videoId));
        String url = YouTubeUrls.watchUrl(videoId);
        Text text = texts.createUnchecked(owner, title, req.language(), transcript.content(), url, req.isPublic(),
                transcript.cues(), ContentLimit.VIDEO);
        Integer duration = player.durationSeconds() != null ? player.durationSeconds() : lastCueEnd(transcript.cues());
        Category fromYouTube = Category.fromYouTube(player.youtubeCategory());
        return finish(text, videoId, duration, transcript.cues(), req.category(), fromYouTube);
    }

    public Text copyForLibrary(User library, VideoCopy copy) {
        String videoId = YouTubeUrls.videoId("https://youtu.be/" + copy.videoId());
        String content = copy.content() == null ? "" : copy.content().strip();
        List<Cue> cues = copy.cues() == null ? List.of() : copy.cues();
        if (cues.stream().anyMatch(cue -> !fits(cue, content))) {
            throw ApiException.badRequest("A caption doesn't fit the transcript");
        }
        Text text = texts.createUnchecked(library, copy.title(), copy.language(), content,
                YouTubeUrls.watchUrl(videoId), true, cues, ContentLimit.VIDEO);
        Integer duration = copy.durationSeconds() != null ? copy.durationSeconds() : lastCueEnd(cues);
        return finish(text, videoId, duration, cues, copy.category(), Category.OTHER);
    }

    private Text finish(Text text, String videoId, Integer duration, List<Cue> cues, Category chosen,
                        Category fallback) {
        text.setVideo(videoId, duration);
        text.setCategory(review.reviewImport(chosen, text, fallback));
        text.setTimingsJson(json.writeValueAsString(timings(texts.tokens(text), cues, duration)));
        return text;
    }

    private static boolean fits(Cue cue, String content) {
        return cue.charStart() >= 0 && cue.charStart() <= cue.charEnd() && cue.charEnd() <= content.length()
                && cue.startMs() >= 0 && cue.startMs() <= cue.endMs();
    }

    private Transcript transcript(VideoImport req, PlayerInfo player) {
        if (req.file() != null && !req.file().isEmpty()) {
            SubtitleParser.Parsed parsed = SubtitleParser.parse(read(req.file()));
            return new Transcript(parsed.content(), parsed.cues());
        }
        if (req.transcript() != null && !req.transcript().isBlank()) {
            return new Transcript(req.transcript(), List.of());
        }
        Optional<Track> track = CaptionParser.pickTrack(player.tracks(), req.language());
        List<Cue> cues = track.map(youtube::captions).orElse(List.of());
        if (cues.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "no_captions", "No " + req.language().displayName()
                    + " captions found — upload a subtitle file or paste the transcript");
        }
        ContentLimit.VIDEO.check(cues.stream().mapToInt(cue -> cue.text().length() + 1).sum() - 1);
        SubtitleParser.Parsed joined = tidy.tidy(req.language(), track.get().autoGenerated(), cues);
        return new Transcript(joined.content(), joined.cues());
    }

    static List<AudioAligner.WordTiming> timings(List<Token> tokens, List<Cue> cues, Integer durationSeconds) {
        if (!cues.isEmpty()) {
            return AudioAligner.fromCues(tokens, cues);
        }
        return durationSeconds == null ? List.of() : AudioAligner.estimate(tokens, durationSeconds * 1000L);
    }

    static Integer lastCueEnd(List<Cue> cues) {
        return cues.isEmpty() ? null : (int) Math.ceil(cues.getLast().endMs() / 1000.0);
    }

    private static String orElse(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String read(MultipartFile file) {
        try {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read the uploaded file");
        }
    }
}
