package app.lector.translation;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * A word's machine translation into a learner's native language (word-translations.feature). Each word and language
 * pair is asked of Amazon Translate once and stored for everyone; within the monthly character cap, and never when
 * machine translation is off. Failures are not stored, so a later lookup tries again.
 */
@Service
public class MachineTranslations {

    private static final Logger log = LoggerFactory.getLogger(MachineTranslations.class);

    private final TranslationClient client;
    private final MachineTranslationRepository stored;
    private final TranslationUsageRepository usage;
    private final TranslationProperties settings;
    private final Clock clock;

    public MachineTranslations(TranslationClient client, MachineTranslationRepository stored,
                               TranslationUsageRepository usage, TranslationProperties settings, Clock clock) {
        this.client = client;
        this.stored = stored;
        this.usage = usage;
        this.settings = settings;
        this.clock = clock;
    }

    /**
     * The translation of {@code text} (a form of the word {@code term}, its normalized key) from {@code source} into
     * {@code target}, or empty when there is none to show.
     */
    public Optional<String> translate(Language source, NativeLanguage target, String term, String text) {
        if (!client.enabled() || term.isEmpty() || term.length() > 200) {
            return Optional.empty();
        }
        Optional<MachineTranslation> known = stored.findBySourceLanguageAndTargetLanguageAndTerm(source, target, term);
        if (known.isPresent()) {
            return Optional.ofNullable(known.get().getTranslation());
        }
        String month = YearMonth.now(clock.withZone(ZoneOffset.UTC)).toString();
        if (usage.add(month, text.length(), settings.monthlyCharacterCap()) == 0) {
            log.warn("Machine translation cap of {} characters reached for {}", settings.monthlyCharacterCap(), month);
            return Optional.empty();
        }
        Optional<String> answer = client.translate(text, source.code(), target.code()).map(String::strip);
        if (answer.isEmpty()) {
            return Optional.empty();
        }
        String useful = answer.get().isEmpty() || answer.get().equalsIgnoreCase(text) ? null : answer.get();
        stored.insertIfAbsent(source.name(), target.name(), term, cut(useful), clock.instant());
        return Optional.ofNullable(cut(useful));
    }

    private static String cut(String s) {
        return s == null ? null : s.substring(0, Math.min(s.length(), 500));
    }
}
