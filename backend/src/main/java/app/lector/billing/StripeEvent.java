package app.lector.billing;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "stripe_events")
public class StripeEvent {

    @Id
    private String id;

    private Instant receivedAt;

    protected StripeEvent() {}

    StripeEvent(String id, Instant receivedAt) {
        this.id = id;
        this.receivedAt = receivedAt;
    }
}
