package app.lector.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;

/** A (UTC) day on which a user used the app, for the admin panel's active-user counts. */
@Entity
@Table(name = "user_days", uniqueConstraints = @UniqueConstraint(name = "uk_user_days_user_day",
        columnNames = {"user_id", "day"}))
public class UserDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate day;

    protected UserDay() {}

    public Long getUserId() { return userId; }
    public LocalDate getDay() { return day; }
}
