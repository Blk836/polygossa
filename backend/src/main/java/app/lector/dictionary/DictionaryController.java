package app.lector.dictionary;

import app.lector.ai.AiAllowance;
import app.lector.ai.AiTutor;
import app.lector.token.Language;
import app.lector.token.TokenizationService;
import app.lector.translation.InContext;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.PlanService;
import app.lector.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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

    private final OwnLanguageMeanings meanings;
    private final AiTutor ai;
    private final AiAllowance allowance;
    private final PlanService plans;
    private final CurrentUser currentUser;

    public DictionaryController(OwnLanguageMeanings meanings, AiTutor ai, AiAllowance allowance, PlanService plans,
                                CurrentUser currentUser) {
        this.meanings = meanings;
        this.ai = ai;
        this.allowance = allowance;
        this.plans = plans;
        this.currentUser = currentUser;
    }

    /**
     * Looks up a word or phrase: its meanings in the learner's own language, from other learners' saved meanings, else
     * a machine translation (lingq-style-lookup.feature). Never calls the AI. {@code before} and {@code after} are the
     * text around the word in its sentence, for a word Amazon gives back unchanged (translation-in-context.feature).
     */
    @GetMapping
    public WordLookup lookup(@AuthenticationPrincipal AuthUser principal,
                             @RequestParam Language language,
                             @RequestParam String term,
                             @RequestParam(required = false) String before,
                             @RequestParam(required = false) String after) {
        String surface = checked(term);
        User user = currentUser.load(principal);
        return meanings.lookup(language, user.getNativeLanguage(), TokenizationService.normalize(surface, language),
                surface, InContext.of(before, surface, after));
    }

    /** The AI's explanation of a word, in the learner's language, when they ask for it (Pro). */
    @GetMapping("/explain")
    public DictionaryResult explain(@AuthenticationPrincipal AuthUser principal,
                                    @RequestParam Language language,
                                    @RequestParam String term,
                                    @RequestParam(required = false) String context) {
        String surface = checked(term);
        User user = currentUser.load(principal);
        plans.require(user, PlanService.Feature.AI);
        return allowance.call(user, () -> ai.define(language, user.getNativeLanguage(), surface, context));
    }

    private static String checked(String term) {
        String surface = term.strip();
        if (surface.isEmpty() || surface.length() > 200) {
            throw new IllegalArgumentException("term must be 1-200 characters");
        }
        return surface;
    }

    /** AI-generated example sentence (Pro). */
    @GetMapping("/example")
    public AiTutor.Example example(@AuthenticationPrincipal AuthUser principal,
                                   @RequestParam Language language,
                                   @RequestParam String term,
                                   @RequestParam(required = false) String definition) {
        User user = currentUser.load(principal);
        plans.require(user, PlanService.Feature.AI);
        return allowance.call(user, () -> ai.example(language, user.getNativeLanguage(), term, definition));
    }

    /** AI translation of a phrase or mined sentence (Pro). */
    @PostMapping("/translate")
    public TranslateResponse translate(@AuthenticationPrincipal AuthUser principal,
                                       @Valid @RequestBody TranslateRequest req) {
        User user = currentUser.load(principal);
        plans.require(user, PlanService.Feature.AI);
        return new TranslateResponse(allowance.call(user,
                () -> ai.translate(req.language(), user.getNativeLanguage(), req.text())));
    }
}
