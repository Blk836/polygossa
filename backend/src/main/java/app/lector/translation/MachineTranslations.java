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
 * machine translation is off. Failures are not stored, so a later lookup tries again. A word that comes back unchanged
 * is asked once more, marked inside its sentence, and the marked words become its meaning
 * (translation-in-context.feature).
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
     * {@code target}, or empty when there is none to show. {@code context} is the word inside its sentence, if any.
     */
    public Optional<String> translate(Language source, NativeLanguage target, String term, String text,
                                      Optional<InContext> context) {
        if (!client.enabled() || term.isEmpty() || term.length() > 200) {
            return Optional.empty();
        }
        Optional<MachineTranslation> known = stored.findBySourceLanguageAndTargetLanguageAndTerm(source, target, term);
        if (known.isPresent()) {
            MachineTranslation k = known.get();
            if (k.getTranslation() != null || k.isTriedInContext()) {
                return Optional.ofNullable(k.getTranslation());
            }
            return inContext(source, target, term, context);
        }
        return alone(source, target, term, text, context);
    }

    /** Asks a word nobody looked up yet on its own, stores the answer, and asks in context if it came back unchanged. */
    private Optional<String> alone(Language source, NativeLanguage target, String term, String text,
                                   Optional<InContext> context) {
        Optional<String> answer = send(text, source, target);
        if (answer.isEmpty()) {
            return Optional.empty();
        }
        String useful = answer.get().isEmpty() || answer.get().equalsIgnoreCase(text) ? null : cut(answer.get());
        stored.insertIfAbsent(source.name(), target.name(), term, useful, clock.instant());
        return useful != null ? Optional.of(useful) : inContext(source, target, term, context);
    }

    /** Asks a word stored as echoed again inside its sentence, and stores what that gave. */
    private Optional<String> inContext(Language source, NativeLanguage target, String term,
                                       Optional<InContext> context) {
        if (context.isEmpty()) {
            return Optional.empty();
        }
        Optional<String> answer = send(context.get().marked(), source, target);
        if (answer.isEmpty()) {
            return Optional.empty();
        }
        Optional<String> meaning = InContext.meaning(answer.get(), context.get().word());
        stored.recordInContext(source.name(), target.name(), term, meaning.orElse(null));
        return meaning;
    }

    /** Amazon's answer for {@code text}, counted against the monthly cap; empty when capped or on failure. */
    private Optional<String> send(String text, Language source, NativeLanguage target) {
        String month = YearMonth.now(clock.withZone(ZoneOffset.UTC)).toString();
        if (usage.add(month, text.length(), settings.monthlyCharacterCap()) == 0) {
            log.warn("Machine translation cap of {} characters reached for {}", settings.monthlyCharacterCap(), month);
            return Optional.empty();
        }
        return client.translate(text, source.code(), target.code()).map(String::strip);
    }

    private static String cut(String s) {
        return s.substring(0, Math.min(s.length(), 500));
    }
}
