package app.lector.recommend;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ActiveWeights {

    private final RecommendProperties props;
    private final Weights configured;
    private final boolean enabled;
    private final AtomicReference<Weights> learned = new AtomicReference<>();

    @Autowired
    public ActiveWeights(RecommendProperties props) {
        this.props = props;
        this.configured = props.weights();
        this.enabled = props.learn().enabled();
    }

    ActiveWeights(Weights configured, boolean enabled) {
        this.props = null;
        this.configured = configured;
        this.enabled = enabled;
    }

    RecommendProperties ranking() {
        return props.withWeights(current());
    }

    void update(Optional<Weights> fit) {
        learned.set(fit.orElse(null));
    }

    public Weights current() {
        Weights w = learned.get();
        return enabled && w != null ? w : configured;
    }

    public String using() {
        return enabled && learned.get() != null ? "learned" : "configured";
    }

    Optional<Weights> learned() {
        return Optional.ofNullable(learned.get());
    }

    Weights configured() {
        return configured;
    }
}
