package app.lector.user;

import app.lector.billing.StripeProperties;
import app.lector.common.ApiException;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;
import java.util.Arrays;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AccountController {

    public record UpdateMeRequest(
            @Size(min = 1, max = 80) String displayName,
            Language targetLanguage,
            NativeLanguage nativeLanguage,
            @Min(1) @Max(500) Integer dailyReviewGoal,
            DailyGoal dailyGoal,
            Boolean streakNeedsGoal,
            String timezone,
            Boolean tours,
            HoneyJar honeyJar) {}

    public record ChangePlanRequest(@NotNull Tier tier) {}

    public record LanguageDto(String code, String name, String speechLocale, boolean spaceDelimited) {}

    public record NativeLanguageDto(String code, String name, String nativeName) {}

    public record PlanDto(Tier tier, String name, String price, List<String> includes) {}

    private final CurrentUser currentUser;
    private final PlanService plans;
    private final Admins admins;
    private final Clock clock;
    private final StripeProperties stripe;

    public AccountController(CurrentUser currentUser, PlanService plans, Admins admins, Clock clock,
                             StripeProperties stripe) {
        this.clock = clock;
        this.stripe = stripe;
        this.currentUser = currentUser;
        this.plans = plans;
        this.admins = admins;
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public MeDto me(@AuthenticationPrincipal AuthUser principal) {
        return MeDto.of(currentUser.load(principal), plans, admins);
    }

    @PatchMapping("/me")
    @Transactional
    public MeDto update(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody UpdateMeRequest req) {
        User user = currentUser.load(principal);
        if (req.displayName() != null) {
            user.setDisplayName(req.displayName().trim());
        }
        if (req.targetLanguage() != null) {
            user.setTargetLanguage(req.targetLanguage());
        }
        if (req.nativeLanguage() != null) {
            user.setNativeLanguage(req.nativeLanguage());
        }
        if (req.dailyReviewGoal() != null) {
            user.setDailyReviewGoal(req.dailyReviewGoal());
        }
        if (req.dailyGoal() != null) {
            user.setDailyGoal(req.dailyGoal());
        }
        if (req.streakNeedsGoal() != null) {
            user.setStreakNeedsGoal(req.streakNeedsGoal());
        }
        if (req.timezone() != null) {
            try {
                user.setTimezone(ZoneId.of(req.timezone()).getId());
            } catch (Exception e) {
                throw ApiException.badRequest("Unknown time zone: " + req.timezone());
            }
        }
        applyDisplayChoices(user, req);
        return MeDto.of(user, plans, admins);
    }

    private static void applyDisplayChoices(User user, UpdateMeRequest req) {
        if (req.tours() != null) {
            user.setToursOn(req.tours());
        }
        if (req.honeyJar() != null) {
            user.setHoneyJar(req.honeyJar());
        }
    }

    @PostMapping("/me/tours/{name}/seen")
    @Transactional
    public MeDto tourSeen(@AuthenticationPrincipal AuthUser principal, @PathVariable String name) {
        User user = currentUser.load(principal);
        if (!Tours.validName(name)) {
            throw ApiException.badRequest("Tour names are lower-case letters and dashes, 30 at most");
        }
        if (!user.markTourSeen(name)) {
            throw ApiException.badRequest("Too many tours");
        }
        return MeDto.of(user, plans, admins);
    }

    @PostMapping("/me/sign-out-everywhere")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void signOutEverywhere(@AuthenticationPrincipal AuthUser principal) {
        currentUser.load(principal).signOutEverywhere(clock.instant());
    }

    @PostMapping("/me/plan")
    @Transactional
    public MeDto changePlan(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody ChangePlanRequest req) {
        if (stripe.enabled()) {
            throw ApiException.forbidden("Plans change through checkout in Settings › Subscription");
        }
        User user = currentUser.load(principal);
        user.setTier(req.tier());
        return MeDto.of(user, plans, admins);
    }

    @GetMapping("/languages")
    public List<LanguageDto> languages() {
        return Arrays.stream(Language.values())
                .map(l -> new LanguageDto(l.code(), l.displayName(), l.speechLocale(), l.spaceDelimited()))
                .toList();
    }

    @GetMapping("/languages/native")
    public List<NativeLanguageDto> nativeLanguages() {
        return Arrays.stream(NativeLanguage.values())
                .map(l -> new NativeLanguageDto(l.code(), l.displayName(), l.nativeName()))
                .toList();
    }

    @GetMapping("/plans")
    public List<PlanDto> pricing() {
        return List.of(
                new PlanDto(Tier.FREE, "Free", "€0",
                        List.of("5 imported texts", "500 saved words", "Basic dictionary")),
                new PlanDto(Tier.PRO, "Pro", "€8/mo or €60/yr",
                        List.of("Unlimited texts & words", "Spaced repetition review", "Audio sync", "AI features")),
                new PlanDto(Tier.CLASSROOM, "Classroom", "€4/student/mo",
                        List.of("All Pro features", "Classroom management", "Pro access for your students")));
    }
}
