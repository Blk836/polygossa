package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.writing.MutableClock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Feature: A fast e2e suite, reusing outside answers for a while (docs/acceptance/e2e-speed.feature). */
class RecentAnswersTest {

    private final MutableClock clock = new MutableClock();
    private final List<String> asked = new ArrayList<>();

    private String ask(String key) {
        asked.add(key);
        return "answer " + key;
    }

    @Test
    void keepsAtMostMaxAnswersDroppingTheLeastRecentlyUsed() {
        RecentAnswers<String> answers = new RecentAnswers<>(Duration.ofMinutes(10), clock, a -> true);
        for (int i = 0; i < RecentAnswers.MAX; i++) {
            answers.get("k" + i, this::ask);
        }
        answers.get("k0", this::ask); // k0 is now the most recently used; k1 the least
        answers.get("new", this::ask); // one too many: k1 goes
        asked.clear();
        answers.get("k0", this::ask);
        answers.get("k2", this::ask);
        assertThat(asked).isEmpty();
        answers.get("k1", this::ask);
        assertThat(asked).containsExactly("k1");
    }

    @Test
    void answersNotKeptAreAskedAgain() {
        RecentAnswers<String> answers = new RecentAnswers<>(Duration.ofMinutes(10), clock, a -> false);
        answers.get("a", this::ask);
        answers.get("a", this::ask);
        assertThat(asked).containsExactly("a", "a");
    }

    @Test
    void aNegativeTimeKeepsNothing() {
        RecentAnswers<String> answers = new RecentAnswers<>(Duration.ofMinutes(-1), clock, a -> true);
        assertThat(answers.get("a", this::ask)).isEqualTo("answer a");
        answers.get("a", this::ask);
        assertThat(asked).containsExactly("a", "a");
    }

    @Test
    void anAnswerIsGoodUntilJustBeforeItsTimeIsUp() {
        RecentAnswers<String> answers = new RecentAnswers<>(Duration.ofSeconds(60), clock, a -> true);
        answers.get("a", this::ask);
        clock.advance(Duration.ofMillis(59_999));
        answers.get("a", this::ask);
        assertThat(asked).containsExactly("a");
        clock.advance(Duration.ofMillis(1));
        answers.get("a", this::ask);
        assertThat(asked).containsExactly("a", "a");
    }
}
