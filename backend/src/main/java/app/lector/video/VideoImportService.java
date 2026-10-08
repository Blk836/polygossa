package app.lector.video;

import app.lector.common.ApiException;
import app.lector.text.AudioAligner;
import app.lector.text.Category;
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
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/**
 * Imports a YouTube video as a library item: the transcript becomes the text (tokenized, levelled and shared like any
 * text) and its caption timings drive word highlighting while the embedded video plays.
 */
@Service
public class VideoImportService {

    /**
     * The import form. {@code file} (subtitles) wins over {@code transcript}, which wins over fetched captions; with no
     * {@code category}, AI picks one from the transcript, else YouTube's own category decides.
     */
    public record VideoImport(String url, Language language, String title, boolean isPublic, MultipartFile file,
                              String transcript, Category category) {}

    /**
     * A video imported on another backend and copied here: its finished transcript and captions, so YouTube isn't
     * asked. With no {@code category}, AI picks one, else {@link Category#OTHER}.
     */
    public record VideoCopy(String videoId, Language language, String title, Category category,
                            Integer durationSeconds, String content, List<Cue> cues) {}

    private record Transcript(String content, List<Cue> cues) {}

    /** {@link TextService#create} or {@link TextService#createUnchecked}. */
    private interface Creator {
        Text create(User owner, String title, Language language, String content, String sourceUrl, boolean isPublic,
                    List<Cue> cues);
    }

    private final TextService texts;
    private final PlanService plans;
    private final YouTubeClient youtube;
    private final ObjectMapper json;
    private final ContentReview review;

    public VideoImportService(TextService texts, PlanService plans, YouTubeClient youtube, ObjectMapper json,
                              ContentReview review) {
        this.texts = texts;
        this.plans = plans;
        this.youtube = youtube;
        this.json = json;
        this.review = review;
    }

    /** Must run inside a transaction so the video fields set after creation are saved. */
    public Text importVideo(User owner, VideoImport req) {
        String videoId = YouTubeUrls.videoId(req.url());
        plans.checkCanImportText(owner); // before any calls to YouTube
        return save(owner, videoId, req, texts::create);
    }

    /** For the community library account (curated videos): as {@link #importVideo}, without plan limits. */
    public Text importForLibrary(User library, VideoImport req) {
        return save(library, YouTubeUrls.videoId(req.url()), req, texts::createUnchecked);
    }

    private Text save(User owner, String videoId, VideoImport req, Creator creator) {
        Optional<YouTubeClient.Metadata> meta = youtube.metadata(videoId);
        PlayerInfo player = youtube.player(videoId);
        Transcript transcript = transcript(req, player);
        String title = orElse(req.title(), orElse(meta.map(YouTubeClient.Metadata::title).orElse(null),
                "YouTube video " + videoId));
        String url = YouTubeUrls.watchUrl(videoId);
        Text text = creator.create(owner, title, req.language(), transcript.content(), url, req.isPublic(),
                transcript.cues());
        Integer duration = player.durationSeconds() != null ? player.durationSeconds() : lastCueEnd(transcript.cues());
        Category fromYouTube = Category.fromYouTube(player.youtubeCategory());
        return finish(text, videoId, duration, transcript.cues(), req.category(), fromYouTube);
    }

    /** For the community library account: saves a copy publicly, without plan limits and without asking YouTube. */
    public Text copyForLibrary(User library, VideoCopy copy) {
        String videoId = YouTubeUrls.videoId("https://youtu.be/" + copy.videoId());
        String content = copy.content() == null ? "" : copy.content().strip();
        List<Cue> cues = copy.cues() == null ? List.of() : copy.cues();
        if (cues.stream().anyMatch(cue -> !fits(cue, content))) {
            throw ApiException.badRequest("A caption doesn't fit the transcript");
        }
        Text text = texts.createUnchecked(library, copy.title(), copy.language(), content,
                YouTubeUrls.watchUrl(videoId), true, cues);
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
        List<Cue> cues = CaptionParser.pickTrack(player.tracks(), req.language())
                .map(youtube::captions)
                .orElse(List.of());
        if (cues.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "no_captions", "No " + req.language().displayName()
                    + " captions found — upload a subtitle file or paste the transcript");
        }
        SubtitleParser.Parsed joined = SubtitleParser.join(cues);
        return new Transcript(joined.content(), joined.cues());
    }

    /** Word timings from the captions, else spread evenly over the video's length, else none. */
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
