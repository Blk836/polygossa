package app.lector.curator;

import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class TranscriptionLimits {

    private final int maxMinutes;
    private final double budgetUsd;
    private final double usdPerMinute;
    private final long maxAudioBytes;
    private final AudioTranscriptionRepository usage;

    public TranscriptionLimits(@Value("${app.transcription.max-minutes:30}") int maxMinutes,
                               @Value("${app.transcription.budget-usd:10}") double budgetUsd,
                               @Value("${app.transcription.usd-per-minute:0.006}") double usdPerMinute,
                               @Value("${app.transcription.max-audio-bytes:26214400}") long maxAudioBytes,
                               AudioTranscriptionRepository usage) {
        this.maxMinutes = maxMinutes;
        this.budgetUsd = budgetUsd;
        this.usdPerMinute = usdPerMinute;
        this.maxAudioBytes = maxAudioBytes;
        this.usage = usage;
    }

    public double cost(long seconds) {
        return Math.round(seconds / 60.0 * usdPerMinute * 1000) / 1000.0;
    }

    public Optional<String> tooLong(int seconds) {
        if (seconds <= maxMinutes * 60) {
            return Optional.empty();
        }
        return Optional.of(Math.round(seconds / 60.0) + " min is over the " + maxMinutes + "-minute limit");
    }

    public Optional<String> overBudget(double cost) {
        double spent = cost(usage.totalAudioSeconds());
        if (spent + cost <= budgetUsd) {
            return Optional.empty();
        }
        return Optional.of("transcription budget used up: " + money(spent) + " of " + money(budgetUsd)
                + " spent, and this would cost " + money(cost));
    }

    public Optional<String> tooBig(long bytes) {
        if (bytes <= maxAudioBytes) {
            return Optional.empty();
        }
        return Optional.of(String.format(Locale.ROOT, "the audio is %.1f MB, over Whisper's %.0f MB limit",
                bytes / 1048576.0, maxAudioBytes / 1048576.0));
    }

    private static String money(double usd) {
        return String.format(Locale.ROOT, "$%.2f", usd);
    }
}
