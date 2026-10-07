package app.lector.user;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Notes the (UTC) days users are active, once per user and day: remembered in memory, written in a transaction of its
 * own so a read-only request can still record it, and never failing the request it rides on.
 */
@Component
public class ActiveDays {

    private final UserDayRepository days;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final Set<Long> seenToday = ConcurrentHashMap.newKeySet();
    private volatile LocalDate today;

    public ActiveDays(UserDayRepository days, PlatformTransactionManager transactions, Clock clock) {
        this.days = days;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactions);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void seen(Long userId) {
        LocalDate day = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (!day.equals(today)) {
            seenToday.clear();
            today = day;
        }
        if (seenToday.add(userId)) {
            try {
                tx.executeWithoutResult(s -> days.record(userId, day));
            } catch (RuntimeException e) {
                seenToday.remove(userId); // try again on the next request
            }
        }
    }
}
