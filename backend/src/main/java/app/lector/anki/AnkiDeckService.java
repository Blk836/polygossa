package app.lector.anki;

import app.lector.common.ApiException;
import app.lector.token.Language;
import app.lector.token.TokenizationService;
import app.lector.user.User;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnkiDeckService {

    public record NoteTypeRequest(@NotNull Long modelId, @NotBlank @Size(max = 200) String name,
                                  @Size(max = 100) String wordField, @Size(max = 100) String meaningField) {}

    public record DeckRequest(@NotNull Long ankiDeckId, @NotBlank @Size(max = 200) String name,
                              @NotNull Language language, @NotBlank @Size(max = 100) String wordField,
                              @Size(max = 100) String meaningField,
                              @Size(max = 200) List<@Valid @NotNull NoteTypeRequest> noteTypes) {}

    public record DecksRequest(@NotNull @Size(max = 50) List<@Valid @NotNull DeckRequest> decks) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record NoteTypeDto(long modelId, String name, String wordField, String meaningField) {
        static NoteTypeDto of(AnkiNoteType t) {
            return new NoteTypeDto(t.getModelId(), t.getName(), t.getWordField(), t.getMeaningField());
        }
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record DeckDto(long ankiDeckId, String name, Language language, String wordField, String meaningField,
                          Instant firstSyncedAt, List<NoteTypeDto> noteTypes) {
        static DeckDto of(AnkiDeck d) {
            return new DeckDto(d.getAnkiDeckId(), d.getName(), d.getLanguage(), d.getWordField(), d.getMeaningField(),
                    d.getFirstSyncedAt(), d.getNoteTypes().stream().map(NoteTypeDto::of).toList());
        }
    }

    public record DecksDto(List<DeckDto> decks) {}

    public record WordLinkDto(AnkiCardState state, boolean promoted) {}

    private final AnkiDeckRepository decks;
    private final AnkiLinkRepository links;

    public AnkiDeckService(AnkiDeckRepository decks, AnkiLinkRepository links) {
        this.decks = decks;
        this.links = links;
    }

    @Transactional(readOnly = true)
    public Optional<WordLinkDto> word(User user, Language language, String term) {
        List<AnkiLink> found = links.findForTerm(user.getId(), language, TokenizationService.normalize(term, language));
        return found.stream().map(AnkiLink::getState).reduce(AnkiCardState::best)
                .map(state -> new WordLinkDto(state, found.stream().anyMatch(AnkiLink::isPromoted)));
    }

    @Transactional(readOnly = true)
    public DecksDto list(User user) {
        return new DecksDto(decks.findByUserIdOrderById(user.getId()).stream().map(DeckDto::of).toList());
    }

    @Transactional
    public DecksDto choose(User user, DecksRequest req) {
        Set<Long> ids = new HashSet<>();
        for (DeckRequest d : req.decks()) {
            if (!ids.add(d.ankiDeckId())) {
                throw ApiException.badRequest("The same deck is listed twice");
            }
        }
        Map<Long, AnkiDeck> current = decks.findByUserIdOrderById(user.getId()).stream()
                .collect(Collectors.toMap(AnkiDeck::getAnkiDeckId, Function.identity()));
        current.values().stream().filter(d -> !ids.contains(d.getAnkiDeckId())).forEach(decks::delete);
        for (DeckRequest d : req.decks()) {
            AnkiDeck deck = current.computeIfAbsent(d.ankiDeckId(), id -> new AnkiDeck(user.getId(), id));
            deck.choose(d.name().strip(), d.language(), d.wordField().strip(), field(d.meaningField()));
            deck.noteTypes(noteTypes(d.noteTypes()));
            decks.save(deck);
        }
        decks.flush();
        return list(user);
    }

    private static List<AnkiNoteType> noteTypes(List<NoteTypeRequest> requested) {
        if (requested == null) {
            return List.of();
        }
        Set<Long> models = new HashSet<>();
        for (NoteTypeRequest t : requested) {
            if (!models.add(t.modelId())) {
                throw ApiException.badRequest("The same note type is listed twice");
            }
        }
        return requested.stream()
                .map(t -> new AnkiNoteType(t.modelId(), t.name().strip(), field(t.wordField()), field(t.meaningField())))
                .toList();
    }

    private static String field(String name) {
        return name == null || name.isBlank() ? null : name.strip();
    }

    @Transactional
    public void disconnect(User user) {
        decks.deleteAll(decks.findByUserIdOrderById(user.getId()));
    }
}
