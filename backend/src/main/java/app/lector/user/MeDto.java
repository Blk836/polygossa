package app.lector.user;

import app.lector.token.Language;

public record MeDto(
        Long id,
        String email,
        String displayName,
        Language targetLanguage,
        int dailyReviewGoal,
        String timezone,
        PlanService.PlanInfo plan) {

    static MeDto of(User user, PlanService plans) {
        return new MeDto(user.getId(), user.getEmail(), user.getDisplayName(), user.getTargetLanguage(),
                user.getDailyReviewGoal(), user.getTimezone(), plans.describe(user));
    }
}
