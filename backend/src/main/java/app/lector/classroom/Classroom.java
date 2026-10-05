package app.lector.classroom;

import app.lector.token.Language;
import app.lector.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "classrooms")
public class Classroom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_id")
    private User teacher;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Language language;

    /** Students join with this code. */
    @Column(nullable = false, unique = true, length = 12)
    private String joinCode;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    protected Classroom() {}

    public Classroom(String name, User teacher, Language language, String joinCode) {
        this.name = name;
        this.teacher = teacher;
        this.language = language;
        this.joinCode = joinCode;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public User getTeacher() { return teacher; }
    public Language getLanguage() { return language; }
    public String getJoinCode() { return joinCode; }
    public void setJoinCode(String joinCode) { this.joinCode = joinCode; }
    public Instant getCreatedAt() { return createdAt; }
}
