package app.lector.text;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * What AI made of a public text, once, for Explore recommendations: topic tags, a one-line summary, register and
 * audience, and an embedding vector. Kept apart from the text and its body so card lists never load it; failed
 * attempts are counted and retried after a back-off.
 */
@Entity
@Table(name = "text_features", uniqueConstraints = @UniqueConstraint(name = "uk_text_features_text",
        columnNames = "text_id"))
public class TextFeature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "text_id", nullable = false)
    private Long textId;

    /** Topic tags, lower-case English, joined by '|' (and wrapped in it, so a LIKE can match a whole tag). */
    @Column(length = 400)
    private String topics;

    @Column(length = 300)
    private String summary;

    @Column(length = 24)
    private String register;

    @Column(length = 16)
    private String suitableFor;

    /** The chat model that tagged it; null until tagging succeeded. */
    private String tagModel;

    /** Little-endian float32s; null until embedding succeeded. */
    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(length = 65_536)
    private byte[] vector;

    private String embeddingModel;

    @Column(nullable = false)
    private int attempts;

    private Instant nextAttemptAt;

    private Instant updatedAt;

    /** Bumped on every change, so caches know when to reload the vector. */
    @Version
    private long version;

    protected TextFeature() {}

    public TextFeature(Long textId) {
        this.textId = textId;
    }

    /** A topic tag: 1–40 letters, digits, spaces, hyphens or apostrophes, starting with a letter or digit. */
    private static final Pattern TOPIC = Pattern.compile("[\\p{L}\\p{N}][\\p{L}\\p{N} '\\-]{0,39}");

    /** The tag in its stored form (trimmed, lower case, single spaces), or null when it isn't a valid tag. */
    public static String normaliseTopic(String raw) {
        String topic = raw.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return TOPIC.matcher(topic).matches() ? topic : null;
    }

    /** A LIKE pattern matching rows tagged with exactly this (valid, normalised) topic. */
    public static String topicPattern(String topic) {
        return "%|" + topic + "|%";
    }

    public static String joinTopics(List<String> topics) {
        return topics.isEmpty() ? null : "|" + String.join("|", topics) + "|";
    }

    public Long getTextId() { return textId; }
    public String getSummary() { return summary; }
    public String getRegister() { return register; }
    public String getSuitableFor() { return suitableFor; }
    public String getTagModel() { return tagModel; }
    public String getEmbeddingModel() { return embeddingModel; }
    public int getAttempts() { return attempts; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public long getVersion() { return version; }

    public List<String> getTopics() {
        return topics == null ? List.of() : Arrays.stream(topics.split("\\|")).filter(s -> !s.isEmpty()).toList();
    }

    public TextFeature withTags(List<String> topics, String summary, String register, String suitableFor,
                                String model) {
        this.topics = joinTopics(topics);
        this.summary = summary;
        this.register = register;
        this.suitableFor = suitableFor;
        this.tagModel = model;
        return this;
    }

    public TextFeature withEmbedding(float[] vector, String model) {
        ByteBuffer buffer = ByteBuffer.allocate(vector.length * Float.BYTES).order(ByteOrder.LITTLE_ENDIAN);
        for (float v : vector) {
            buffer.putFloat(v);
        }
        this.vector = buffer.array();
        this.embeddingModel = model;
        return this;
    }

    /** The embedding, or null when there is none. */
    public float[] vector() {
        if (vector == null) {
            return null;
        }
        ByteBuffer buffer = ByteBuffer.wrap(vector).order(ByteOrder.LITTLE_ENDIAN);
        float[] out = new float[vector.length / Float.BYTES];
        for (int i = 0; i < out.length; i++) {
            out[i] = buffer.getFloat();
        }
        return out;
    }

    /** Records the outcome of a run: success clears the failure count; a failure schedules the next try. */
    public void attempted(boolean succeeded, Instant now, Instant nextTry) {
        this.attempts = succeeded ? 0 : attempts + 1;
        this.nextAttemptAt = succeeded ? null : nextTry;
        this.updatedAt = now;
    }
}
