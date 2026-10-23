package app.lector.video;

import app.lector.ai.AiClient;
import app.lector.common.ApiException;
import app.lector.text.SubtitleParser.Cue;
import app.lector.token.Language;
import java.time.Clock;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AudioTranscriber {

    public record Heard(List<Cue> cues, long audioSeconds) {}

    static final String WAY = " — upload a subtitle file or paste the transcript";

    private final YtDlpClient ytDlp;
    private final AiClient ai;
    private final TranscriptionLimits limits;
    private final AudioTranscriptionRepository usage;
    private final TransactionTemplate ownTransaction;
    private final Clock clock;

    public AudioTranscriber(YtDlpClient ytDlp, AiClient ai, TranscriptionLimits limits,
                            AudioTranscriptionRepository usage, PlatformTransactionManager transactions, Clock clock) {
        this.ytDlp = ytDlp;
        this.ai = ai;
        this.limits = limits;
        this.usage = usage;
        this.ownTransaction = new TransactionTemplate(transactions);
        this.ownTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.clock = clock;
    }

    public boolean available() {
        return ytDlp.enabled() && ai.enabled();
    }

    public Heard transcribe(String videoId, Language language, Integer knownSeconds) {
        int seconds = knownSeconds != null ? knownSeconds : ytDlp.durationSeconds(videoId)
                .orElseThrow(() -> refused("no_captions", "Couldn't read this video's captions or find its length"));
        limits.tooLong(seconds).ifPresent(problem -> {
            throw refused("too_long", problem + " for videos without captions");
        });
        limits.overBudget(limits.cost(seconds)).ifPresent(problem -> {
            throw refused("over_budget", "Can't transcribe this video's audio: " + problem);
        });
        YtDlpClient.Audio audio = download(videoId);
        WhisperCaptions.Heard heard = WhisperCaptions.read(whisper(audio), language);
        ownTransaction.executeWithoutResult(s ->
                usage.save(new AudioTranscription(videoId, heard.audioSeconds(), clock.instant())));
        if (heard.problem() != null) {
            throw refused("no_speech", "Couldn't transcribe this video's audio: " + heard.problem());
        }
        return new Heard(heard.cues(), heard.audioSeconds());
    }

    private YtDlpClient.Audio download(String videoId) {
        YtDlpClient.Download download = ytDlp.download(videoId, limits.maxAudioBytes());
        if (download.failure() != null) {
            throw refused("no_captions", "Couldn't read this video's captions or download its audio ("
                    + download.failure() + ")");
        }
        if (download.audio() == null) {
            throw refused("audio_too_big", limits.tooBig(download.sizeBytes()).orElse("the audio is too big"));
        }
        return download.audio();
    }

    private tools.jackson.databind.JsonNode whisper(YtDlpClient.Audio audio) {
        try {
            return ai.transcribe(audio.bytes(), audio.filename());
        } catch (ApiException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error",
                    "Transcribing this video's audio failed — try again shortly");
        }
    }

    private static ApiException refused(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, code, message + WAY);
    }
}
