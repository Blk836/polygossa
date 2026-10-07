package app.lector.vocab;

import app.lector.text.Text;
import app.lector.token.Language;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record VocabularyDto(
        Long id,
        String term,
        String displayTerm,
        Language language,
        EntryKind kind,
        WordStatus status,
        String definition,
        String partOfSpeech,
        String pronunciation,
        String example,
        String contextSentence,
        String note,
        List<String> tags,
        SourceText sourceText,
        Instant createdAt,
        Instant updatedAt,
        Instant dueAt) {

    public record SourceText(Long id, String title) {}

    public static VocabularyDto of(VocabularyEntry e) {
        Text t = e.getSourceText();
        return new VocabularyDto(e.getId(), e.getTerm(), e.getDisplayTerm(), e.getLanguage(), e.getKind(),
                e.getStatus(), e.getDefinition(), e.getPartOfSpeech(), e.getPronunciation(), e.getExample(),
                e.getContextSentence(), e.getNote(), e.getTags(), t == null ? null : new SourceText(t.getId(), t.getTitle()),
                e.getCreatedAt(), e.getUpdatedAt(),
                e.getStatus() == WordStatus.LEARNING ? e.getSrs().getDueAt() : null);
    }
}
