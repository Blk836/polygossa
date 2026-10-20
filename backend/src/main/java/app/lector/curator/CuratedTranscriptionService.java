package app.lector.curator;

import app.lector.ai.AiClient;
import app.lector.common.ApiException;
import app.lector.curator.CuratedVideoService.CuratedVideo;
import app.lector.text.Category;
import app.lector.token.Language;
import app.lector.video.CaptionParser;
import app.lector.video.CaptionParser.PlayerInfo;
import app.lector.video.WhisperCaptions;
import app.lector.video.YouTubeClient;
import app.lector.video.YouTubeUrls;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.IOException;
import java.time.Clock;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CuratedTranscriptionService {

    static final String WOULD_TRANSCRIBE = "would_transcribe";

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Transcription(String outcome, String videoId, Long id, String title, Category category,
                                Integer durationSeconds, Double costUsd, String message) {

        static Transcription refused(String outcome, String videoId, String message) {
            return new Transcription(outcome, videoId, null, null, null, null, null, message);
        }

        static Transcription of(CuratedVideo video) {
            return new Transcription(video.outcome(), video.videoId(), video.id(), video.title(), video.category(),
                    null, null, null);
        }

        public boolean transcribed() {
            return CuratedVideoService.TRANSCRIBED.equals(outcome);
        }
    }

    private final CuratedVideoService videos;
    private final YouTubeClient youtube;
    private final AiClient ai;
    private final TranscriptionLimits limits;
    private final AudioTranscriptionRepository usage;
    private final Clock clock;

    public CuratedTranscriptionService(CuratedVideoService videos, YouTubeClient youtube, AiClient ai,
                                       TranscriptionLimits limits, AudioTranscriptionRepository usage, Clock clock) {
        this.videos = videos;
        this.youtube = youtube;
        this.ai = ai;
        this.limits = limits;
        this.usage = usage;
        this.clock = clock;
    }

    public Transcription quote(String url, Language language) {
        if (!ai.enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "transcription_off",
                    "transcription is switched off on the backend: start it with OPENAI_API_KEY set");
        }
        if (language == null) {
            throw ApiException.badRequest("language is required");
        }
        String videoId = YouTubeUrls.videoId(url);
        Optional<CuratedVideo> existing = videos.existing(videoId);
        if (existing.isPresent()) {
            return Transcription.of(existing.get());
        }
        PlayerInfo player = youtube.player(videoId);
        if (CaptionParser.pickTrack(player.tracks(), language).map(youtube::captions).filter(c -> !c.isEmpty())
                .isPresent()) {
            return Transcription.refused("has_captions", videoId, null);
        }
        return priced(videoId, player.durationSeconds());
    }

    private Transcription priced(String videoId, Integer seconds) {
        if (seconds == null) {
            return Transcription.refused("unknown_length", videoId,
                    "YouTube doesn't give this video's length, so its cost can't be known in advance");
        }
        Optional<String> tooLong = limits.tooLong(seconds);
        if (tooLong.isPresent()) {
            return Transcription.refused("too_long", videoId, tooLong.get());
        }
        double cost = limits.cost(seconds);
        Optional<String> overBudget = limits.overBudget(cost);
        if (overBudget.isPresent()) {
            return Transcription.refused("over_budget", videoId, overBudget.get());
        }
        return new Transcription(WOULD_TRANSCRIBE, videoId, null, null, null, seconds, cost, null);
    }

    public Transcription transcribe(String url, Language language, Category category, MultipartFile audio) {
        Transcription quote = quote(url, language);
        if (!WOULD_TRANSCRIBE.equals(quote.outcome())) {
            return quote;
        }
        byte[] bytes = bytes(audio);
        WhisperCaptions.Heard heard = WhisperCaptions.read(ai.transcribe(bytes, filename(audio)), language);
        usage.save(new AudioTranscription(quote.videoId(), heard.audioSeconds(), clock.instant()));
        if (heard.problem() != null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "no_speech", heard.problem());
        }
        return Transcription.of(videos.importTranscribed(quote.videoId(), language, category, heard.cues()));
    }

    private byte[] bytes(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw ApiException.badRequest("audio is required");
        }
        limits.tooBig(audio.getSize()).ifPresent(problem -> {
            throw new ApiException(HttpStatus.BAD_REQUEST, "audio_too_big", problem);
        });
        try {
            return audio.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read the uploaded audio");
        }
    }

    private static String filename(MultipartFile audio) {
        String name = audio.getOriginalFilename();
        return name == null || name.isBlank() ? "audio.webm" : name;
    }
}
