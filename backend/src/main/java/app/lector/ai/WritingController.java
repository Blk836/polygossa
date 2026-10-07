package app.lector.ai;

import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.PlanService;
import app.lector.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

/** AI writing tutor: write a short response to a text and get corrective feedback. */
@RestController
@RequestMapping("/api/writing")
public class WritingController {

    public record SubmitRequest(Long textId, @NotNull Language language, @NotBlank @Size(max = 4000) String content) {}

    public record SubmissionDto(Long id, Long textId, Language language, String content, AiTutor.Feedback feedback,
                                Instant createdAt) {}

    private static final int EXCERPT_CHARS = 1500;

    private final WritingSubmissionRepository repo;
    private final AiTutor tutor;
    private final AiAllowance allowance;
    private final TextService texts;
    private final PlanService plans;
    private final CurrentUser currentUser;
    private final ObjectMapper json;

    public WritingController(WritingSubmissionRepository repo, AiTutor tutor, AiAllowance allowance, TextService texts,
                             PlanService plans, CurrentUser currentUser, ObjectMapper json) {
        this.repo = repo;
        this.tutor = tutor;
        this.allowance = allowance;
        this.texts = texts;
        this.plans = plans;
        this.currentUser = currentUser;
        this.json = json;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SubmissionDto submit(@AuthenticationPrincipal AuthUser principal, @Valid @RequestBody SubmitRequest req) {
        User user = currentUser.load(principal);
        plans.require(user, PlanService.Feature.AI);
        Text text = req.textId() == null ? null : texts.loadReadable(user, req.textId());
        String excerpt = text == null ? null
                : text.getContent().length() > EXCERPT_CHARS ? text.getContent().substring(0, EXCERPT_CHARS) + "…"
                : text.getContent();
        AiTutor.Feedback feedback = allowance.call(user,
                () -> tutor.writingFeedback(req.language(), user.getNativeLanguage(), excerpt, req.content().strip()));
        WritingSubmission submission = new WritingSubmission(user, text, req.language(), req.content().strip());
        submission.setFeedbackJson(json.writeValueAsString(feedback));
        return toDto(repo.save(submission));
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<SubmissionDto> list(@AuthenticationPrincipal AuthUser principal, @RequestParam Long textId) {
        User user = currentUser.load(principal);
        return repo.findByUserIdAndTextIdOrderByCreatedAtDesc(user.getId(), textId).stream().map(this::toDto).toList();
    }

    private SubmissionDto toDto(WritingSubmission s) {
        AiTutor.Feedback feedback = s.getFeedbackJson() == null ? null
                : json.readValue(s.getFeedbackJson(), AiTutor.Feedback.class);
        return new SubmissionDto(s.getId(), s.getText() == null ? null : s.getText().getId(), s.getLanguage(),
                s.getContent(), feedback, s.getCreatedAt());
    }
}
