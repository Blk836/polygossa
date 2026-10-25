package app.lector.text;

import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.user.User;
import app.lector.vocab.WordStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class TextDtos {

    private TextDtos() {}

    public record OwnerDto(Long id, String displayName, String photoUrl) {
        public static OwnerDto of(User owner) {
            return new OwnerDto(owner.getId(), owner.getDisplayName(), owner.photoUrl());
        }
    }

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
            boolean fromBook,
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

        public TextSummary withProgress(ProgressDto p) {
            return new TextSummary(id, title, language, cefrLevel, wordCount, uniqueWordCount, isPublic, fromBook,
                    sourceUrl, createdAt, owner, mine, hasAudio, likes, liked, bookmarked, stats, kind, video, category, p);
        }
    }

    public record ProgressDto(int position, int percent, boolean completed) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record VideoInfo(String videoId, String thumbnailUrl, Integer durationSeconds) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record VideoDto(String videoId, Integer durationSeconds, List<AudioAligner.WordTiming> timings,
                           boolean hasCues) {}

    public record PhraseStatus(String term, WordStatus status) {}

    public record AudioDto(String src, String contentType, List<AudioAligner.WordTiming> timings, boolean hasCues) {}

    public record TextDetail(
            TextSummary text,
            List<Token> tokens,
            Map<String, WordStatus> statuses,
            List<PhraseStatus> phrases,
            AudioDto audio,
            VideoDto video,
            String speechLocale,
            List<String> setAside) {}
}
