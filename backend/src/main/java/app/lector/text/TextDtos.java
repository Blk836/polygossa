package app.lector.text;

import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.vocab.WordStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class TextDtos {

    private TextDtos() {}

    public record OwnerDto(Long id, String displayName) {}

    /** How much of a text's vocabulary the viewer already knows. */
    public record KnownStats(int uniqueWords, int known, int learning, int ignored, int unseen, double knownPercent) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TextSummary(
            Long id,
            String title,
            Language language,
            String cefrLevel,
            int wordCount,
            int uniqueWordCount,
            boolean isPublic,
            String sourceUrl,
            Instant createdAt,
            OwnerDto owner,
            boolean mine,
            boolean hasAudio,
            Long likes,
            Boolean liked,
            Boolean bookmarked,
            KnownStats stats,
            MediaKind kind,
            VideoInfo video,
            Category category,
            ProgressDto progress) {

        /** This summary with the viewer's reading progress (null: not started). */
        public TextSummary withProgress(ProgressDto p) {
            return new TextSummary(id, title, language, cefrLevel, wordCount, uniqueWordCount, isPublic, sourceUrl,
                    createdAt, owner, mine, hasAudio, likes, liked, bookmarked, stats, kind, video, category, p);
        }
    }

    /**
     * How far the viewer has read: {@code position} is the token to resume at, {@code percent} the share of words
     * before the furthest point reached (100 once finished).
     */
    public record ProgressDto(int position, int percent, boolean completed) {}

    /** Card-level video facts; null for texts. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record VideoInfo(String videoId, String thumbnailUrl, Integer durationSeconds) {}

    /** What the reader needs to play a video in sync with its transcript. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record VideoDto(String videoId, Integer durationSeconds, List<AudioAligner.WordTiming> timings,
                           boolean hasCues) {}

    public record PhraseStatus(String term, WordStatus status) {}

    public record AudioDto(String src, String contentType, List<AudioAligner.WordTiming> timings, boolean hasCues) {}

    public record TextDetail(
            TextSummary text,
            List<Token> tokens,
            /* normalized term → status, for words in this text the user has an entry for */
            Map<String, WordStatus> statuses,
            List<PhraseStatus> phrases,
            AudioDto audio,
            VideoDto video,
            String speechLocale) {}
}
