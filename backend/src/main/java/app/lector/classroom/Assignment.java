package app.lector.classroom;

import app.lector.text.Text;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "assignments")
public class Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id")
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "text_id")
    private Text text;

    private LocalDate dueDate;

    @Column(length = 1000)
    private String note;

    @Column(nullable = false)
    private Instant assignedAt = Instant.now();

    protected Assignment() {}

    public Assignment(Classroom classroom, Text text, LocalDate dueDate, String note) {
        this.classroom = classroom;
        this.text = text;
        this.dueDate = dueDate;
        this.note = note;
    }

    public Long getId() { return id; }
    public Classroom getClassroom() { return classroom; }
    public Text getText() { return text; }
    public LocalDate getDueDate() { return dueDate; }
    public String getNote() { return note; }
    public Instant getAssignedAt() { return assignedAt; }
}
