package app.lector.classroom;

import app.lector.common.ApiException;
import app.lector.session.ReadingSessionRepository;
import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClassroomService {

    public record ClassSummary(Long id, String name, Language language, String role, String teacherName,
                               String joinCode, long studentCount, Instant createdAt) {}

    public record AssignmentDto(Long id, Long textId, String textTitle, String cefrLevel, int wordCount,
                                LocalDate dueDate, String note, Instant assignedAt, Boolean opened, Boolean completed) {}

    public record StudentDto(Long id, String displayName, String photoUrl, String email, Instant joinedAt) {}

    public record ClassDetail(ClassSummary info, List<AssignmentDto> assignments, List<StudentDto> students) {}

    public record StudentProgress(Long id, String displayName, String photoUrl, long knownWords, long learningWords,
                                  long wordsAdded7d, long wordsAdded30d, long sessions, long readingSeconds,
                                  int assignmentsOpened, int assignmentsCompleted, Instant lastActive) {}

    public record ClassProgress(int assignmentCount, List<StudentProgress> students, double averageKnownWords,
                                double averageReadingMinutes, double assignmentCompletionRate) {}

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ClassroomRepository classrooms;
    private final ClassroomMemberRepository members;
    private final AssignmentRepository assignments;
    private final TextService texts;
    private final VocabularyRepository vocabulary;
    private final ReadingSessionRepository sessions;
    private final PlanService plans;
    private final ApplicationEventPublisher events;

    public ClassroomService(ClassroomRepository classrooms, ClassroomMemberRepository members,
                            AssignmentRepository assignments, TextService texts,
                            VocabularyRepository vocabulary, ReadingSessionRepository sessions, PlanService plans,
                            ApplicationEventPublisher events) {
        this.events = events;
        this.classrooms = classrooms;
        this.members = members;
        this.assignments = assignments;
        this.texts = texts;
        this.vocabulary = vocabulary;
        this.sessions = sessions;
        this.plans = plans;
    }

    @Transactional
    public ClassSummary create(User teacher, String name, Language language) {
        plans.require(teacher, PlanService.Feature.CLASSROOM);
        Classroom c = classrooms.save(new Classroom(name.strip(), teacher, language, newCode()));
        return summary(c, teacher);
    }

    @Transactional(readOnly = true)
    public List<ClassSummary> listForUser(User user) {
        List<ClassSummary> out = new ArrayList<>();
        for (Classroom c : classrooms.findByTeacherIdOrderByCreatedAtDesc(user.getId())) {
            out.add(summary(c, user));
        }
        for (ClassroomMember m : members.findByStudentId(user.getId())) {
            out.add(summary(m.getClassroom(), user));
        }
        return out;
    }

    @Transactional
    public ClassSummary join(User student, String code) {
        Classroom c = classrooms.findByJoinCodeIgnoreCase(code.strip())
                .orElseThrow(() -> ApiException.notFound("Class with that code"));
        if (c.getTeacher().getId().equals(student.getId())) {
            throw ApiException.badRequest("You teach this class");
        }
        if (!members.existsByClassroomIdAndStudentId(c.getId(), student.getId())) {
            members.save(new ClassroomMember(c, student));
            events.publishEvent(new ClassMembersChanged(c.getTeacher().getId()));
        }
        return summary(c, student);
    }

    @Transactional(readOnly = true)
    public ClassDetail detail(User user, Long id) {
        Classroom c = loadVisible(user, id);
        boolean teacher = isTeacher(user, c);
        List<Assignment> list = assignments.findByClassroomId(id);
        Set<Long> textIds = list.stream().map(a -> a.getText().getId()).collect(Collectors.toSet());
        Set<Long> opened = teacher || textIds.isEmpty() ? Set.of() : Set.copyOf(sessions.openedTextIds(user.getId(), textIds));
        Set<Long> completed = teacher || textIds.isEmpty() ? Set.of() : Set.copyOf(sessions.completedTextIds(user.getId(), textIds));
        List<AssignmentDto> dtos = list.stream().map(a -> {
            Text t = a.getText();
            return new AssignmentDto(a.getId(), t.getId(), t.getTitle(), t.getCefrLevel(), t.getWordCount(),
                    a.getDueDate(), a.getNote(), a.getAssignedAt(),
                    teacher ? null : opened.contains(t.getId()), teacher ? null : completed.contains(t.getId()));
        }).toList();
        List<StudentDto> students = teacher
                ? members.findByClassroomId(id).stream()
                        .map(m -> new StudentDto(m.getStudent().getId(), m.getStudent().getDisplayName(),
                                m.getStudent().photoUrl(), m.getStudent().getEmail(), m.getJoinedAt()))
                        .toList()
                : List.of();
        return new ClassDetail(summary(c, user), dtos, students);
    }

    @Transactional
    public AssignmentDto assign(User teacher, Long classId, Long textId, LocalDate dueDate, String note) {
        Classroom c = loadTaught(teacher, classId);
        Text text = texts.loadReadable(teacher, textId);
        if (text.getLanguage() != c.getLanguage()) {
            throw ApiException.badRequest("This class studies " + c.getLanguage().displayName()
                    + "; the text is in " + text.getLanguage().displayName());
        }
        Assignment a = assignments.save(new Assignment(c, text, dueDate, note == null || note.isBlank() ? null : note.strip()));
        return new AssignmentDto(a.getId(), text.getId(), text.getTitle(), text.getCefrLevel(), text.getWordCount(),
                a.getDueDate(), a.getNote(), a.getAssignedAt(), null, null);
    }

    @Transactional
    public void unassign(User teacher, Long classId, Long assignmentId) {
        loadTaught(teacher, classId);
        Assignment a = assignments.findById(assignmentId)
                .filter(x -> x.getClassroom().getId().equals(classId))
                .orElseThrow(() -> ApiException.notFound("Assignment"));
        assignments.delete(a);
    }

    /** Teachers can remove any student; students can remove themselves (leave the class). */
    @Transactional
    public void removeMember(User user, Long classId, Long studentId) {
        Classroom c = loadVisible(user, classId);
        if (!isTeacher(user, c) && !user.getId().equals(studentId)) {
            throw ApiException.forbidden("Only the teacher can remove students");
        }
        members.findByClassroomIdAndStudentId(classId, studentId).ifPresent(m -> {
            members.delete(m);
            events.publishEvent(new ClassMembersChanged(c.getTeacher().getId()));
        });
    }

    @Transactional
    public ClassSummary regenerateCode(User teacher, Long classId) {
        Classroom c = loadTaught(teacher, classId);
        c.setJoinCode(newCode());
        return summary(c, teacher);
    }

    @Transactional
    public void delete(User teacher, Long classId) {
        Classroom c = loadTaught(teacher, classId);
        assignments.deleteByClassroomId(classId);
        members.deleteByClassroomId(classId);
        classrooms.delete(c);
        events.publishEvent(new ClassMembersChanged(teacher.getId()));
    }

    /** Aggregate reading progress and vocabulary growth per student, in the class's language. */
    @Transactional(readOnly = true)
    public ClassProgress progress(User teacher, Long classId) {
        Classroom c = loadTaught(teacher, classId);
        Language lang = c.getLanguage();
        Set<Long> textIds = assignments.findByClassroomId(classId).stream()
                .map(a -> a.getText().getId()).collect(Collectors.toSet());
        Instant now = Instant.now();
        List<StudentProgress> rows = new ArrayList<>();
        for (ClassroomMember m : members.findByClassroomId(classId)) {
            Long sid = m.getStudent().getId();
            int opened = textIds.isEmpty() ? 0 : sessions.openedTextIds(sid, textIds).size();
            int completed = textIds.isEmpty() ? 0 : sessions.completedTextIds(sid, textIds).size();
            rows.add(new StudentProgress(sid, m.getStudent().getDisplayName(), m.getStudent().photoUrl(),
                    vocabulary.countByUserIdAndLanguageAndStatus(sid, lang, WordStatus.KNOWN),
                    vocabulary.countByUserIdAndLanguageAndStatus(sid, lang, WordStatus.LEARNING),
                    vocabulary.countCreatedSince(sid, lang, now.minus(7, ChronoUnit.DAYS)),
                    vocabulary.countCreatedSince(sid, lang, now.minus(30, ChronoUnit.DAYS)),
                    sessions.countByUserAndLanguage(sid, lang),
                    sessions.secondsByUserAndLanguage(sid, lang),
                    opened, completed, sessions.lastActive(sid)));
        }
        double avgKnown = rows.stream().mapToLong(StudentProgress::knownWords).average().orElse(0);
        double avgMinutes = rows.stream().mapToLong(StudentProgress::readingSeconds).average().orElse(0) / 60.0;
        double completion = rows.isEmpty() || textIds.isEmpty() ? 0
                : rows.stream().mapToInt(StudentProgress::assignmentsCompleted).sum() / (double) (rows.size() * textIds.size());
        return new ClassProgress(textIds.size(), rows, Math.round(avgKnown * 10) / 10.0,
                Math.round(avgMinutes * 10) / 10.0, Math.round(completion * 1000) / 10.0);
    }

    private Classroom loadVisible(User user, Long id) {
        Classroom c = classrooms.findById(id).orElseThrow(() -> ApiException.notFound("Class"));
        if (!isTeacher(user, c) && !members.existsByClassroomIdAndStudentId(id, user.getId())) {
            throw ApiException.notFound("Class");
        }
        return c;
    }

    private Classroom loadTaught(User user, Long id) {
        Classroom c = classrooms.findById(id).orElseThrow(() -> ApiException.notFound("Class"));
        if (!isTeacher(user, c)) {
            throw ApiException.notFound("Class");
        }
        return c;
    }

    private static boolean isTeacher(User user, Classroom c) {
        return c.getTeacher().getId().equals(user.getId());
    }

    private ClassSummary summary(Classroom c, User viewer) {
        boolean teacher = isTeacher(viewer, c);
        return new ClassSummary(c.getId(), c.getName(), c.getLanguage(), teacher ? "teacher" : "student",
                c.getTeacher().getDisplayName(), teacher ? c.getJoinCode() : null,
                members.countByClassroomId(c.getId()), c.getCreatedAt());
    }

    private String newCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            }
            if (!classrooms.existsByJoinCode(sb.toString())) {
                return sb.toString();
            }
        }
        throw new IllegalStateException("Could not generate a unique class code");
    }

}
