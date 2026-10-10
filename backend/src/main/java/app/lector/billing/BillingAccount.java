package app.lector.billing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "subscriptions")
public class BillingAccount {

    @Id
    private Long userId;

    @Column(nullable = false, length = 64)
    private String stripeCustomerId;

    @Column(length = 64)
    private String stripeSubscriptionId;

    @Column(length = 64)
    private String itemId;

    @Column(length = 32)
    private String plan;

    @Column(length = 8)
    private String billingInterval;

    @Column(length = 32)
    private String status;

    private Instant periodEnd;

    @Column(nullable = false)
    private boolean cancelAtPeriodEnd;

    protected BillingAccount() {}

    BillingAccount(Long userId, String stripeCustomerId) {
        this.userId = userId;
        this.stripeCustomerId = stripeCustomerId;
    }

    void update(String subscriptionId, String itemId, String plan, String interval, String status, Instant periodEnd,
                boolean cancelAtPeriodEnd) {
        this.stripeSubscriptionId = subscriptionId;
        this.itemId = itemId;
        this.plan = plan;
        this.billingInterval = interval;
        this.status = status;
        this.periodEnd = periodEnd;
        this.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }

    public Long getUserId() { return userId; }
    public String getStripeCustomerId() { return stripeCustomerId; }
    public String getStripeSubscriptionId() { return stripeSubscriptionId; }
    public String getItemId() { return itemId; }
    public String getPlan() { return plan; }
    public String getBillingInterval() { return billingInterval; }
    public String getStatus() { return status; }
    public Instant getPeriodEnd() { return periodEnd; }
    public boolean isCancelAtPeriodEnd() { return cancelAtPeriodEnd; }
}
