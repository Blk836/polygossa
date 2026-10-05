package app.lector.user;

/** Subscription tiers from the pricing table. */
public enum Tier {
    /** $0 — 5 imported texts, 500 saved words, basic dictionary. */
    FREE,
    /** $8/mo or $60/yr — unlimited texts and words, SRS, audio sync, AI features. */
    PRO,
    /** $4/student/mo — all Pro features plus classroom management; students in the teacher's classes get Pro. */
    CLASSROOM
}
