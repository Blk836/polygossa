package app.lector.user;

import app.lector.classroom.ClassroomMemberRepository;
import app.lector.common.ApiException;
import app.lector.config.AppProperties;
import app.lector.text.TextRepository;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import org.springframework.stereotype.Service;

@Service
public class PlanService {

    public enum Feature {
        SRS("Spaced repetition review"),
        AUDIO_SYNC("Audio sync"),
        AI("AI features"),
        CLASSROOM("Classroom management");

        private final String label;

        Feature(String label) {
            this.label = label;
        }
    }

    public record Limits(Integer texts, Integer savedWords) {}

    public record Usage(long texts, long savedWords) {}

    public record PlanInfo(Tier tier, Tier effectiveTier, boolean sponsoredByClassroom, Limits limits, Usage usage) {}

    static final int FREE_WORDS_READ_GOAL = 1000;

    private final AppProperties.Billing billing;
    private final ClassroomMemberRepository members;
    private final TextRepository texts;
    private final VocabularyRepository vocabulary;

    public PlanService(AppProperties props, ClassroomMemberRepository members, TextRepository texts,
                       VocabularyRepository vocabulary) {
        this.billing = props.billing();
        this.members = members;
        this.texts = texts;
        this.vocabulary = vocabulary;
    }

    public Tier effectiveTier(User user) {
        if (user.getTier() != Tier.FREE) {
            return user.getTier();
        }
        return members.hasSponsoredMembership(user.getId()) ? Tier.PRO : Tier.FREE;
    }

    public boolean hasFeature(User user, Feature feature) {
        if (!billing.enforceLimits()) {
            return true;
        }
        Tier tier = effectiveTier(user);
        return switch (feature) {
            case SRS, AUDIO_SYNC, AI -> tier != Tier.FREE;
            case CLASSROOM -> tier == Tier.CLASSROOM;
        };
    }

    public DailyGoal dailyGoal(User user) {
        DailyGoal goal = user.getDailyGoal();
        if (goal.kind() == GoalKind.REVIEWS && !hasFeature(user, Feature.SRS)) {
            return new DailyGoal(GoalKind.WORDS_READ, FREE_WORDS_READ_GOAL);
        }
        return goal;
    }

    public void require(User user, Feature feature) {
        if (!hasFeature(user, feature)) {
            String plan = feature == Feature.CLASSROOM ? "the Classroom plan" : "Pro";
            throw ApiException.upgradeRequired(feature.label + " requires " + plan + ".");
        }
    }

    public void checkCanImportText(User user) {
        if (isLimited(user) && texts.countByOwnerId(user.getId()) >= billing.freeTextLimit()) {
            throw ApiException.upgradeRequired("The free plan includes " + billing.freeTextLimit()
                    + " imported texts and videos. Upgrade to Pro for unlimited imports, or delete an old one.");
        }
    }

    public void checkCanImportTexts(User user, int count) {
        if (!isLimited(user)) {
            return;
        }
        long left = Math.max(0, billing.freeTextLimit() - texts.countByOwnerId(user.getId()));
        if (count > left) {
            throw ApiException.upgradeRequired("This book needs " + count + " texts and the free plan has " + left
                    + " left. Upgrade to Pro for unlimited imports, or delete old texts.");
        }
    }

    public void checkCanSaveWord(User user) {
        if (isLimited(user) && vocabulary.countByUserIdAndStatus(user.getId(), WordStatus.LEARNING) >= billing.freeWordLimit()) {
            throw ApiException.upgradeRequired("The free plan includes " + billing.freeWordLimit()
                    + " saved words. Mark some as known or upgrade to Pro for unlimited words.");
        }
    }

    public long savedWordsLeft(User user) {
        if (!isLimited(user)) {
            return Long.MAX_VALUE;
        }
        return Math.max(0, billing.freeWordLimit() - vocabulary.countByUserIdAndStatus(user.getId(), WordStatus.LEARNING));
    }

    public PlanInfo describe(User user) {
        Tier effective = effectiveTier(user);
        boolean limited = isLimited(user);
        Limits limits = limited ? new Limits(billing.freeTextLimit(), billing.freeWordLimit()) : new Limits(null, null);
        Usage usage = new Usage(texts.countByOwnerId(user.getId()),
                vocabulary.countByUserIdAndStatus(user.getId(), WordStatus.LEARNING));
        return new PlanInfo(user.getTier(), effective, user.getTier() == Tier.FREE && effective != Tier.FREE, limits, usage);
    }

    private boolean isLimited(User user) {
        return billing.enforceLimits() && effectiveTier(user) == Tier.FREE;
    }
}
