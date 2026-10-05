package app.lector.dictionary;

import app.lector.ai.AiAllowance;
import app.lector.ai.AiTutor;
import app.lector.token.Language;
import app.lector.token.TokenizationService;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.PlanService;
import app.lector.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dictionary")
public class DictionaryController {

    public record TranslateRequest(@NotNull Language language, @NotBlank @Size(max = 2000) String text) {}

    public record TranslateResponse(String translation) {}

    private final DictionaryClient dictionary;
    private final AiTutor ai;
    private final AiAllowance allowance;
    private final PlanService plans;
    private final CurrentUser currentUser;

    public DictionaryController(DictionaryClient dictionary, AiTutor ai, AiAllowance allowance, PlanService plans,
                                CurrentUser currentUser) {
        this.dictionary = dictionary;
        this.ai = ai;
        this.allowance = allowance;
        this.plans = plans;
        this.currentUser = currentUser;
    }

    /**
     * Looks up a word or phrase. Tries the form as written, then lower-case, then capitalized (German nouns), and
     * finally the AI dictionary for Pro users when the free sources have nothing.
     */
    @GetMapping
    public DictionaryResult lookup(@AuthenticationPrincipal AuthUser principal,
                                   @RequestParam Language language,
                                   @RequestParam String term,
                                   @RequestParam(required = false) String context) {
        String surface = term.strip();
        if (surface.isEmpty() || surface.length() > 200) {
            throw new IllegalArgumentException("term must be 1-200 characters");
        }
        Locale locale = Locale.forLanguageTag(language.code());
        Set<String> variants = new LinkedHashSet<>();
        variants.add(surface);
        variants.add(surface.toLowerCase(locale));
        variants.add(surface.substring(0, 1).toUpperCase(locale) + surface.substring(1).toLowerCase(locale));
        DictionaryResult result = null;
        for (String variant : variants) {
            result = dictionary.lookup(language, variant);
            if (result.found()) {
                break;
            }
        }
        User user = currentUser.load(principal);
        if (!result.found() && ai.enabled() && plans.hasFeature(user, PlanService.Feature.AI)) {
            result = allowance.call(user, () -> ai.define(language, surface, context));
        }
        return result.found() ? result : DictionaryResult.notFound(TokenizationService.normalize(surface, language),
                language.code());
    }

    /** AI-generated example sentence (Pro). */
    @GetMapping("/example")
    public AiTutor.Example example(@AuthenticationPrincipal AuthUser principal,
                                   @RequestParam Language language,
                                   @RequestParam String term,
                                   @RequestParam(required = false) String definition) {
        User user = currentUser.load(principal);
        plans.require(user, PlanService.Feature.AI);
        return allowance.call(user, () -> ai.example(language, term, definition));
    }

    /** AI translation of a phrase or mined sentence (Pro). */
    @PostMapping("/translate")
    public TranslateResponse translate(@AuthenticationPrincipal AuthUser principal,
                                       @Valid @RequestBody TranslateRequest req) {
        User user = currentUser.load(principal);
        plans.require(user, PlanService.Feature.AI);
        return new TranslateResponse(allowance.call(user, () -> ai.translate(req.language(), req.text())));
    }
}
