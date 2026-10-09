package app.lector.recommend;

import app.lector.text.Category;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "user_interests", uniqueConstraints = @UniqueConstraint(name = "uk_interest",
        columnNames = {"user_id", "category"}))
public class UserInterest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Category category;

    protected UserInterest() {}

    public UserInterest(Long userId, Category category) {
        this.userId = userId;
        this.category = category;
    }

    public Category getCategory() { return category; }
}
