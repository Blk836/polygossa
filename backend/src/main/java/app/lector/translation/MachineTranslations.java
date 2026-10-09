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
