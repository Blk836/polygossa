package app.lector.text;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The bulky part of a {@link Text}: its content, tokens, audio timings and subtitle cues, which run to megabytes for a
 * long transcript. Kept in its own table and loaded only when the text itself is opened, so lists of cards (which need
 * only the {@code texts} row) never read it.
 */
@Entity
@Table(name = "text_bodies")
public class TextBody {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** JSON array of {@link app.lector.token.Token}; computed once at import time. */
    @Column(nullable = false, columnDefinition = "text")
    private String tokensJson = "[]";

    /** JSON array of {tokenIndex, startMs, endMs} aligning words to audio, or null. */
    @Column(columnDefinition = "text")
    private String timingsJson;

    /** JSON array of subtitle cues {startMs, endMs, text} kept from SRT/VTT imports, used for audio alignment. */
    @Column(columnDefinition = "text")
    private String cuesJson;

    protected TextBody() {}

    TextBody(String content) {
        this.content = content;
    }

    public String getContent() { return content; }
    public String getTokensJson() { return tokensJson; }
    public void setTokensJson(String tokensJson) { this.tokensJson = tokensJson; }
    public String getTimingsJson() { return timingsJson; }
    public void setTimingsJson(String timingsJson) { this.timingsJson = timingsJson; }
    public String getCuesJson() { return cuesJson; }
    public void setCuesJson(String cuesJson) { this.cuesJson = cuesJson; }
}
