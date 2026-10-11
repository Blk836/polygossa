package app.lector.common;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.ApiTest;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

@ApiTest
class JobLockTest {

    @Autowired
    JobLock lock;

    @Autowired
    DataSource dataSource;

    @Test
    void whileOneRunHoldsTheJobAnotherSkipsItThenRunsLater() throws Exception {
        CountDownLatch holding = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CompletableFuture<Optional<String>> first = CompletableFuture.supplyAsync(() -> lock.runAlone("lock-test-a", () -> {
            holding.countDown();
            await(release);
            return "first";
        }));
        assertThat(holding.await(10, TimeUnit.SECONDS)).isTrue();

        AtomicBoolean ran = new AtomicBoolean();
        assertThat(lock.runAlone("lock-test-a", () -> ran.getAndSet(true))).isEmpty();
        assertThat(ran).isFalse();

        release.countDown();
        assertThat(first.get(10, TimeUnit.SECONDS)).contains("first");
        assertThat(lock.runAlone("lock-test-a", () -> "later")).contains("later");
    }

    @Test
    void differentJobsDoNotBlockEachOther() throws Exception {
        CountDownLatch holding = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CompletableFuture<Optional<String>> first = CompletableFuture.supplyAsync(() -> lock.runAlone("lock-test-b", () -> {
            holding.countDown();
            await(release);
            return "b";
        }));
        assertThat(holding.await(10, TimeUnit.SECONDS)).isTrue();
        assertThat(lock.runAlone("lock-test-c", () -> "c")).contains("c");
        release.countDown();
        first.get(10, TimeUnit.SECONDS);
    }

    @Test
    void aFailingJobReleasesTheLock() {
        try {
            lock.runAlone("lock-test-d", () -> {
                throw new IllegalStateException("boom");
            });
        } catch (IllegalStateException expected) {
            assertThat(expected).hasMessage("boom");
        }
        assertThat(lock.runAlone("lock-test-d", () -> "again")).contains("again");
    }

    @Test
    void aHolderWhoseConnectionClosedNoLongerBlocksTheJob() throws Exception {
        HikariDataSource pool = dataSource.unwrap(HikariDataSource.class);
        try (Connection crashed = DriverManager.getConnection(pool.getJdbcUrl(), pool.getUsername(), pool.getPassword())) {
            assertThat(tryLock(crashed, JobLock.key("lock-test-e"))).isTrue();
            assertThat(lock.runAlone("lock-test-e", () -> "blocked")).isEmpty();
        }
        assertThat(lock.runAlone("lock-test-e", () -> "free")).contains("free");
    }

    private static boolean tryLock(Connection connection, long key) throws Exception {
        try (PreparedStatement ps = connection.prepareStatement("select pg_try_advisory_lock(?)")) {
            ps.setLong(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getBoolean(1);
            }
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
