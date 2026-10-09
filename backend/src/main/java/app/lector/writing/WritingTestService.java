package app.lector.writing;

import app.lector.ai.AiAllowance;
import app.lector.ai.WritingGrader;
import app.lector.ai.WritingGrader.Grade;
import app.lector.common.ApiException;
import app.lector.token.Language;
import app.lector.user.PlanService;
import app.lector.user.User;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

@Service
public class WritingTestService {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TestDto(Long id, Language language, String level, String prompt, int minWords, String unit,
                          int timeLimitSeconds, Instant startedAt, Instant deadline, String status, String content,
                          Integer wordCount, Instant submittedAt, Grade grade, String gradeError, String gradeModel,
                          String gradePromptVersion) {}

    private final WritingTestRepository tests;
    private final WritingGrader grader;
    private final AiAllowance allowance;
    private final PlanService plans;
    private final Clock clock;
    private final ObjectMapper json;
    private final PromptBank bank = PromptBank.load();
    private final Random random = new Random();

    public WritingTestService(WritingTestRepository tests, WritingGrader grader, AiAllowance allowance,
                              PlanService plans, Clock clock, ObjectMapper json) {
        this.tests = tests;
        this.grader = grader;
        this.allowance = allowance;
        this.plans = plans;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public TestDto start(User user, Language language, String level) {
        plans.require(user, PlanService.Feature.AI);
        int minimum = WritingRules.minimum(level, language);
        Instant now = clock.instant();
        var open = tests.findFirstByUserIdAndLanguageAndSubmittedAtIsNullAndDeadlineAfterOrderByStartedAtDesc(
                user.getId(), language, now.minus(WritingRules.GRACE));
        if (open.isPresent()) {
            return dto(open.get());
        }
        Set<String> recent = tests.findTop20ByUserIdAndLevelOrderByStartedAtDesc(user.getId(), level).stream()
                .map(WritingTest::getPromptId).collect(Collectors.toSet());
        PromptBank.Prompt prompt = bank.pick(level, recent, random);
        return dto(tests.save(new WritingTest(user, language, level, prompt, minimum, now,
                now.plus(WritingRules.TIME_LIMIT))));
    }

    @Transactional(readOnly = true)
    public TestDto get(User user, Long id) {
        return dto(load(user, id));
    }

    @Transactional(readOnly = true)
    public List<TestDto> history(User user, Language language) {
        return tests.findTop20ByUserIdAndLanguageOrderByStartedAtDescIdDesc(user.getId(), language).stream()
                .map(this::dto).toList();
    }

    @Transactional
    public TestDto submit(User user, Long id, String content) {
        WritingTest test = load(user, id);
        Instant now = clock.instant();
        if (test.getSubmittedAt() != null) {
            throw ApiException.conflict("This test has already been handed in");
        }
        if (now.isAfter(test.getDeadline().plus(WritingRules.GRACE))) {
            throw ApiException.conflict("Time is up for this test; start a new one");
        }
        String text = content == null ? "" : content.strip();
        int count = WritingRules.count(text, test.getLanguage());
        String unit = WritingRules.unit(test.getLanguage());
        if (count == 0) {
            throw ApiException.badRequest("Write something before handing in");
        }
        if (now.isBefore(test.getDeadline()) && count < test.getMinimum()) {
            throw ApiException.badRequest("Write at least " + test.getMinimum() + " " + unit
                    + " before handing in early (you have " + count + ")");
        }
        test.handIn(text, count, now);
        tryGrade(test);
        return dto(test);
    }

    @Transactional
    public TestDto grade(User user, Long id) {
        WritingTest test = load(user, id);
        if (test.getSubmittedAt() == null || test.getGradeJson() != null) {
            throw ApiException.conflict(test.getSubmittedAt() == null ? "Hand the test in first" : "Already graded");
        }
        tryGrade(test);
        return dto(test);
    }

    private void tryGrade(WritingTest test) {
        String unit = WritingRules.unit(test.getLanguage());
        try {
            Grade grade = allowance.call(test.getUser(), () -> grader.grade(new WritingGrader.Submission(
                    test.getLanguage(), test.getLevel(), test.getSituation(), test.getMinimum(), unit,
                    test.getWordCount(), test.getContent())));
            Grade capped = grade.withScore(WritingRules.capForLength(grade.score(), test.getWordCount(), test.getMinimum()));
            test.graded(json.writeValueAsString(capped), grader.model(), WritingGrader.PROMPT_VERSION);
        } catch (ApiException e) {
            test.gradingFailed(e.getMessage());
        }
    }

    private WritingTest load(User user, Long id) {
        return tests.findById(id).filter(t -> t.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> ApiException.notFound("Writing test"));
    }

    private String status(WritingTest t) {
        if (t.getGradeJson() != null) {
            return "graded";
        }
        if (t.getSubmittedAt() != null) {
            return "ungraded";
        }
        return clock.instant().isAfter(t.getDeadline().plus(WritingRules.GRACE)) ? "expired" : "in_progress";
    }

    private TestDto dto(WritingTest t) {
        Grade grade = t.getGradeJson() == null ? null : json.readValue(t.getGradeJson(), Grade.class);
        boolean handedIn = t.getSubmittedAt() != null;
        return new TestDto(t.getId(), t.getLanguage(), t.getLevel(), t.getSituation(), t.getMinimum(),
                WritingRules.unit(t.getLanguage()), (int) WritingRules.TIME_LIMIT.toSeconds(), t.getStartedAt(),
                t.getDeadline(), status(t), t.getContent(), handedIn ? t.getWordCount() : null, t.getSubmittedAt(),
                grade, grade == null ? t.getGradeError() : null, t.getGradeModel(), t.getGradePromptVersion());
    }
}
