package app.lector.srs;

import app.lector.common.ApiException;
import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.User;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Sentence mining: whole sentences saved to the review queue. */
@RestController
@RequestMapping("/api/sentences")
public class SentenceController {

    public record CreateRequest(@NotNull Language language, @NotBlank @Size(max = 2000) String sentence,
                                @Size(max = 2000) String translation, @Size(max = 2000) String notes, Long textId) {}

    public record UpdateRequest(@Size(max = 2000) String translation, @Size(max = 2000) String notes) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SentenceDto(Long id, Language language, String sentence, String translation, String notes,
                              Long sourceTextId, String sourceTextTitle, Instant createdAt, Instant dueAt) {
        static SentenceDto of(SentenceCard s) {
            Text t = s.getSourceText();
            return new SentenceDto(s.getId(), s.getLanguage(), s.getSentence(), s.getTranslation(), s.getNotes(),
                    t == null ? null : t.getId(), t == null ? null : t.getTitle(), s.getCreatedAt(),
                    s.getSrs().getDueAt());
        }
    }

    private final SentenceCardRepository repo;
    private final TextService texts;
    private final CurrentUser currentUser;

    public SentenceController(SentenceCardRepository repo, TextService texts, CurrentUser currentUser) {
        this.repo = repo;
        this.texts = texts;
        this.currentUser = currentUser;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<SentenceDto> list(@AuthenticationPrincipal AuthUser principal,
                                  @RequestParam(required = false) Language language) {
        return repo.findForUser(currentUser.load(principal).getId(), language).stream().map(SentenceDto::of).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SentenceDto create(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody CreateRequest req) {
        User user = currentUser.load(principal);
        SentenceCard card = new SentenceCard(user, req.language(), req.sentence().strip());
        card.setTranslation(blankToNull(req.translation()));
        card.setNotes(blankToNull(req.notes()));
        if (req.textId() != null) {
            card.setSourceText(texts.loadReadable(user, req.textId()));
        }
        return SentenceDto.of(repo.save(card));
    }

    @PatchMapping("/{id}")
    @Transactional
    public SentenceDto update(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id,
                              @Valid @RequestBody UpdateRequest req) {
        SentenceCard card = loadOwned(principal, id);
        if (req.translation() != null) {
            card.setTranslation(blankToNull(req.translation()));
        }
        if (req.notes() != null) {
            card.setNotes(blankToNull(req.notes()));
        }
        return SentenceDto.of(card);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal AuthUser principal, @PathVariable Long id) {
        repo.delete(loadOwned(principal, id));
    }

    private SentenceCard loadOwned(AuthUser principal, Long id) {
        User user = currentUser.load(principal);
        return repo.findById(id)
                .filter(s -> s.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> ApiException.notFound("Sentence"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
