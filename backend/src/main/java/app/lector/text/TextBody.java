package app.lector.text;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "text_bodies")
public class TextBody {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, columnDefinition = "text")
    private String tokensJson = "[]";

    @Column(columnDefinition = "text")
    private String timingsJson;

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
