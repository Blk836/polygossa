package app.lector.user;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.hibernate.annotations.Formula;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    private String passwordHash;

    @Column(length = 64)
    private String cognitoSub;

    private Instant signedOutAt;

    @Column(nullable = false)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Tier tier = Tier.FREE;

    @Enumerated(EnumType.STRING)
    private Language targetLanguage;

    @Enumerated(EnumType.STRING)
    private NativeLanguage nativeLanguage = NativeLanguage.EN;

    @Column(nullable = false)
    private int dailyReviewGoal = 20;

    @Enumerated(EnumType.STRING)
    private GoalKind dailyGoalKind;

    private Integer dailyGoalTarget;

    private Boolean streakNeedsGoal;

    private Boolean suspended;

    private String suspendedReason;

    @Column(nullable = false)
    private String timezone = "UTC";

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private String photoFile;

    private Boolean toursOn;

    @Column(length = 1300)
    private String toursSeen;

    @Enumerated(EnumType.STRING)
    private HoneyJar honeyJar;

    @Formula("(select count(d.id) from anki_decks d where d.user_id = id)")
    private Long ankiDecks;

    protected User() {}

    public boolean isAnkiConnected() {
        return ankiDecks != null && ankiDecks > 0;
    }

    public User(String email, String passwordHash, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void signOutEverywhere(Instant now) {
        this.signedOutAt = now;
    }

    public boolean acceptsTokenIssuedAt(Instant issuedAt) {
        return signedOutAt == null || (issuedAt != null && issuedAt.isAfter(signedOutAt.truncatedTo(ChronoUnit.SECONDS)));
    }

    public String getCognitoSub() {
        return cognitoSub;
    }

    public void setCognitoSub(String cognitoSub) {
        this.cognitoSub = cognitoSub;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public Tier getTier() {
        return tier;
    }

    public void setTier(Tier tier) {
        this.tier = tier;
    }

    public Language getTargetLanguage() {
        return targetLanguage != null && targetLanguage.isOffered() ? targetLanguage : null;
    }

    public Language storedTargetLanguage() {
        return targetLanguage;
    }

    public void setTargetLanguage(Language targetLanguage) {
        this.targetLanguage = targetLanguage;
    }

    public NativeLanguage getNativeLanguage() {
        return nativeLanguage == null ? NativeLanguage.EN : nativeLanguage;
    }

    public void setNativeLanguage(NativeLanguage nativeLanguage) {
        this.nativeLanguage = nativeLanguage;
    }

    public DailyGoal getDailyGoal() {
        if (dailyGoalKind == null || dailyGoalKind == GoalKind.REVIEWS || dailyGoalTarget == null) {
            return new DailyGoal(GoalKind.REVIEWS, dailyReviewGoal);
        }
        return new DailyGoal(dailyGoalKind, dailyGoalTarget);
    }

    public void setDailyGoal(DailyGoal goal) {
        dailyGoalKind = goal.kind();
        if (goal.kind() == GoalKind.REVIEWS) {
            dailyReviewGoal = goal.target();
            dailyGoalTarget = null;
        } else {
            dailyGoalTarget = goal.target();
        }
    }

    public boolean isSuspended() {
        return Boolean.TRUE.equals(suspended);
    }

    public String getSuspendedReason() {
        return suspendedReason;
    }

    public void setSuspended(boolean suspended, String reason) {
        this.suspended = suspended;
        this.suspendedReason = suspended ? reason : null;
    }

    public boolean isStreakNeedsGoal() {
        return Boolean.TRUE.equals(streakNeedsGoal);
    }

    public void setStreakNeedsGoal(boolean streakNeedsGoal) {
        this.streakNeedsGoal = streakNeedsGoal;
    }

    public int getDailyReviewGoal() {
        return dailyReviewGoal;
    }

    public void setDailyReviewGoal(int dailyReviewGoal) {
        this.dailyReviewGoal = dailyReviewGoal;
    }

    public String getTimezone() {
        return timezone;
    }

    public void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public ZoneId zone() {
        try {
            return ZoneId.of(timezone);
        } catch (Exception e) {
            return ZoneId.of("UTC");
        }
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getPhotoFile() {
        return photoFile;
    }

    public void setPhotoFile(String photoFile) {
        this.photoFile = photoFile;
    }

    public Tours getTours() {
        List<String> seen = toursSeen == null ? List.of() : List.of(toursSeen.split(","));
        return new Tours(Boolean.TRUE.equals(toursOn), seen);
    }

    public void setToursOn(boolean on) {
        toursOn = on;
        if (on) {
            toursSeen = null;
        }
    }

    public boolean markTourSeen(String name) {
        List<String> seen = getTours().seen();
        if (seen.contains(name)) {
            return true;
        }
        if (seen.size() >= Tours.MAX_SEEN) {
            return false;
        }
        toursSeen = toursSeen == null ? name : toursSeen + "," + name;
        return true;
    }

    public HoneyJar getHoneyJar() {
        return honeyJar == null ? HoneyJar.ALL_FORMS : honeyJar;
    }

    public void setHoneyJar(HoneyJar honeyJar) {
        this.honeyJar = honeyJar;
    }

    public String photoUrl() {
        return photoFile == null ? null : "/api/users/" + id + "/photo?v=" + photoFile;
    }
}
