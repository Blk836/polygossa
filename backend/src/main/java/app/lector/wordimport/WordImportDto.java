package app.lector.wordimport;

import app.lector.token.Language;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record WordImportDto(Long id, WordImport.Source source, Language language, WordImport.State state, int found,
                            int added, int updated, int unchanged, int overLimit, String error, Instant createdAt,
                            Instant finishedAt) {

    static WordImportDto of(WordImport j) {
        return new WordImportDto(j.getId(), j.getSource(), j.getLanguage(), j.getState(), j.getFound(), j.getAdded(),
                j.getUpdated(), j.getUnchanged(), j.getOverLimit(), j.getError(), j.getCreatedAt(), j.getFinishedAt());
    }
}
