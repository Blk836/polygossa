package app.lector.text;

import app.lector.token.Language;
import app.lector.user.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "texts", indexes = {
        @Index(name = "idx_texts_owner", columnList = "owner_id"),
        @Index(name = "idx_texts_public_lang", columnList = "is_public,language")
})
public class Text {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "body_id")
    private TextBody body;

    @Column(columnDefinition = "text")
    private String wordsJson;

    @Column(columnDefinition = "text")
    private String personNamesJson;

    private String sourceUrl;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @Column(nullable = false)
    private boolean fromBook;

    private String cefrLevel;

    private int wordCount;

    private int uniqueWordCount;

    private String audioFile;

    private String audioContentType;

    private String audioUrl;

    @Column(length = 16)
    private String videoId;

    private Integer videoDurationSeconds;

    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private Category category;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected Text() {}

    public Text(User owner, String title, Language language, String content) {
        this.owner = owner;
        this.title = title;
        this.language = language;
        this.body = new TextBody(content);
    }

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Language getLanguage() { return language; }
    public String getContent() { return body.getContent(); }
    void setContent(String content) { body.setContent(content); }
    public String getTokensJson() { return body.getTokensJson(); }
    public void setTokensJson(String tokensJson) { body.setTokensJson(tokensJson); }
    public String getWordsJson() { return wordsJson; }
    public void setWordsJson(String wordsJson) { this.wordsJson = wordsJson; }
    public String getPersonNamesJson() { return personNamesJson; }
    public void setPersonNamesJson(String personNamesJson) { this.personNamesJson = personNamesJson; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public boolean isPublic() { return isPublic; }
    public void setPublic(boolean isPublic) { this.isPublic = isPublic; }
    public boolean isFromBook() { return fromBook; }
    public void setFromBook(boolean fromBook) { this.fromBook = fromBook; }
    public String getCefrLevel() { return cefrLevel; }
    public void setCefrLevel(String cefrLevel) { this.cefrLevel = cefrLevel; }
    public int getWordCount() { return wordCount; }
    public void setWordCount(int wordCount) { this.wordCount = wordCount; }
    public int getUniqueWordCount() { return uniqueWordCount; }
    public void setUniqueWordCount(int uniqueWordCount) { this.uniqueWordCount = uniqueWordCount; }
    public String getAudioFile() { return audioFile; }
    public void setAudioFile(String audioFile) { this.audioFile = audioFile; }
    public String getAudioContentType() { return audioContentType; }
    public void setAudioContentType(String audioContentType) { this.audioContentType = audioContentType; }
    public String getAudioUrl() { return audioUrl; }
    public void setAudioUrl(String audioUrl) { this.audioUrl = audioUrl; }
    public String getTimingsJson() { return body.getTimingsJson(); }
    public void setTimingsJson(String timingsJson) { body.setTimingsJson(timingsJson); }
    public String getCuesJson() { return body.getCuesJson(); }
    public void setCuesJson(String cuesJson) { body.setCuesJson(cuesJson); }
    public Category getCategory() { return category == null ? Category.OTHER : category; }
    public void setCategory(Category category) { this.category = category; }
    public String getVideoId() { return videoId; }
    public Integer getVideoDurationSeconds() { return videoDurationSeconds; }

    public void setVideo(String videoId, Integer durationSeconds) {
        this.videoId = videoId;
        this.videoDurationSeconds = durationSeconds;
    }

    public boolean isVideo() {
        return videoId != null;
    }
    public Instant getCreatedAt() { return createdAt; }

    public boolean hasAudio() {
        return audioFile != null || audioUrl != null;
    }
}
