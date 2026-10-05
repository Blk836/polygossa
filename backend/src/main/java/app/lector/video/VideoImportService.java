package app.lector.video;

import app.lector.common.ApiException;
import app.lector.text.AudioAligner;
import app.lector.text.Category;
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
     * {@code category}, YouTube's own category decides.
     */
    public record VideoImport(String url, Language language, String title, boolean isPublic, MultipartFile file,
                              String transcript, Category category) {}

    private record Transcript(String content, List<Cue> cues) {}

    private final TextService texts;
    private final PlanService plans;
    private final YouTubeClient youtube;
    private final ObjectMapper json;

    public VideoImportService(TextService texts, PlanService plans, YouTubeClient youtube, ObjectMapper json) {
        this.texts = texts;
        this.plans = plans;
        this.youtube = youtube;
        this.json = json;
    }

    /** Must run inside a transaction so the video fields set after creation are saved. */
    public Text importVideo(User owner, VideoImport req) {
        return importVideo(owner, req, true);
    }

    /** Imports without plan checks (used by the sample content seeder). Must run inside a transaction. */
    public Text importUnchecked(User owner, VideoImport req) {
        return importVideo(owner, req, false);
    }

    private Text importVideo(User owner, VideoImport req, boolean checkPlan) {
        String videoId = YouTubeUrls.videoId(req.url());
        if (checkPlan) {
            plans.checkCanImportText(owner); // before any calls to YouTube
        }
        Optional<YouTubeClient.Metadata> meta = youtube.metadata(videoId);
        PlayerInfo player = youtube.player(videoId);
        Transcript transcript = transcript(req, player);
        String title = orElse(req.title(), orElse(meta.map(YouTubeClient.Metadata::title).orElse(null),
                "YouTube video " + videoId));
        String url = YouTubeUrls.watchUrl(videoId);
        Text text = checkPlan
                ? texts.create(owner, title, req.language(), transcript.content(), url, req.isPublic(), transcript.cues())
                : texts.createUnchecked(owner, title, req.language(), transcript.content(), url, req.isPublic(),
                        transcript.cues());
        Integer duration = player.durationSeconds() != null ? player.durationSeconds() : lastCueEnd(transcript.cues());
        text.setVideo(videoId, duration);
        text.setCategory(req.category() != null ? req.category() : Category.fromYouTube(player.youtubeCategory()));
        text.setTimingsJson(json.writeValueAsString(timings(texts.tokens(text), transcript.cues(), duration)));
        return text;
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
            throw ApiException.unprocessable("No " + req.language().displayName()
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
