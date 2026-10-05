package app.lector.classroom;

import app.lector.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(name = "classroom_members",
        uniqueConstraints = @UniqueConstraint(name = "uk_member", columnNames = {"classroom_id", "student_id"}))
public class ClassroomMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id")
    private User student;

    @Column(nullable = false)
    private Instant joinedAt = Instant.now();

    protected ClassroomMember() {}

    public ClassroomMember(Classroom classroom, User student) {
        this.classroom = classroom;
        this.student = student;
    }

    public Long getId() { return id; }
    public Classroom getClassroom() { return classroom; }
    public User getStudent() { return student; }
    public Instant getJoinedAt() { return joinedAt; }
}
