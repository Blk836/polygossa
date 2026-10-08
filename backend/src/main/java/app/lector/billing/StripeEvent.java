package app.lector.billing;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A Stripe webhook event already handled: Stripe may send one more than once, and it applies once. */
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
