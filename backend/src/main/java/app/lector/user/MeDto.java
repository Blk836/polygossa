package app.lector.user;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;

public record MeDto(
        Long id,
        String email,
        String displayName,
        Language targetLanguage,
        NativeLanguage nativeLanguage,
        int dailyReviewGoal,
        DailyGoal dailyGoal,
        boolean streakNeedsGoal,
        String timezone,
        PlanService.PlanInfo plan,
        String photoUrl) {

    static MeDto of(User user, PlanService plans) {
        return new MeDto(user.getId(), user.getEmail(), user.getDisplayName(), user.getTargetLanguage(),
                user.getNativeLanguage(), user.getDailyReviewGoal(), user.getDailyGoal(), user.isStreakNeedsGoal(), user.getTimezone(), plans.describe(user), user.photoUrl());
    }
}
