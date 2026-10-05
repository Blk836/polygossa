package app.lector.level;

import app.lector.level.SkillLevels.Overall;
import app.lector.level.SkillLevels.Skill;
import app.lector.progress.ReadingProgressRepository;
import app.lector.progress.ReadingProgressRepository.FinishedText;
import app.lector.session.ReadingSessionRepository;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import app.lector.writing.WritingTest;
import app.lector.writing.WritingTestRepository;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Gathers a learner's evidence in one language and applies {@link SkillLevels} to it. */
@Service
public class SkillLevelService {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Levels(Language language, long knownWords, long listeningSeconds, Skill reading, Skill listening,
                         Skill writing, Overall overall) {}

    private final VocabularyRepository vocabulary;
    private final ReadingProgressRepository progress;
    private final ReadingSessionRepository sessions;
    private final WritingTestRepository writingTests;
    private final ObjectMapper json;

    public SkillLevelService(VocabularyRepository vocabulary, ReadingProgressRepository progress,
                             ReadingSessionRepository sessions, WritingTestRepository writingTests, ObjectMapper json) {
        this.vocabulary = vocabulary;
        this.progress = progress;
        this.sessions = sessions;
        this.writingTests = writingTests;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public Levels levels(User user, Language language) {
        long known = vocabulary.countByUserIdAndLanguageAndStatus(user.getId(), language, WordStatus.KNOWN);
        Map<String, Integer> read = new HashMap<>();
        Map<String, Integer> listened = new HashMap<>();
        for (FinishedText t : progress.findFinished(user.getId(), language)) {
            boolean media = t.getVideoId() != null || t.getAudioFile() != null || t.getAudioUrl() != null;
            (media ? listened : read).merge(t.getLevel(), 1, Integer::sum);
        }
        List<String> graded = writingTests
                .findTop20ByUserIdAndLanguageAndGradeJsonIsNotNullOrderBySubmittedAtDesc(user.getId(), language)
                .stream().map(this::gradedLevel).toList();
        Skill reading = SkillLevels.reading(language, known, read);
        Skill listening = SkillLevels.listening(language, known, listened);
        Skill writing = SkillLevels.writing(graded);
        return new Levels(language, known, sessions.listeningSeconds(user.getId(), language), reading, listening,
                writing, SkillLevels.overall(reading, listening, writing));
    }

    private String gradedLevel(WritingTest test) {
        JsonNode level = json.readTree(test.getGradeJson()).path("level");
        return level.isString() ? level.asString() : null;
    }
}
