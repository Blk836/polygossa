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
        String photoUrl,
        boolean admin,
        Tours tours) {

    static MeDto of(User user, PlanService plans, Admins admins) {
        return new MeDto(user.getId(), user.getEmail(), user.getDisplayName(), user.getTargetLanguage(),
                user.getNativeLanguage(), user.getDailyReviewGoal(), user.getDailyGoal(), user.isStreakNeedsGoal(), user.getTimezone(), plans.describe(user), user.photoUrl(), admins.isAdmin(user), user.getTours());
    }
}
