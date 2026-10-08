package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.time.Duration;
import java.util.ServiceLoader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.testcontainers.dockerclient.DockerClientProviderStrategy;

/**
 * Test JVMs starting together on Windows all find Docker (docs/acceptance/postgres.feature). Testcontainers checks
 * that Docker Desktop's named pipe exists once, without retrying, and on Windows that check fails while the pipe is
 * busy: right after anyone else used it. A JVM that loses that race fails every test it runs.
 */
class WindowsDockerPipeTest {

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void findsDockerRightAfterSomeoneElseUsedThePipe() {
        for (int i = 0; i < 20; i++) {
            new File(WindowsDockerPipe.DOCKER_PIPE).exists(); // someone else uses the pipe a moment before
            assertThat(new WindowsDockerPipe().test()).as("attempt %d", i).isTrue();
        }
    }

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void aPipeThatIsNotThereFailsAfterTheWait() {
        long started = System.nanoTime();

        boolean found = new WindowsDockerPipe("//./pipe/polygossa_no_such_pipe", Duration.ofMillis(500)).test();

        long tookMs = Duration.ofNanos(System.nanoTime() - started).toMillis();
        assertThat(found).isFalse();
        assertThat(tookMs).isBetween(500L, 3_000L);
    }

    @Test
    void testcontainersFindsItAndItLeavesTheUsersSettingsAlone() {
        assertThat(ServiceLoader.load(DockerClientProviderStrategy.class))
                .anyMatch(strategy -> strategy instanceof WindowsDockerPipe);
        // Persisting would write this test-only class into ~/.testcontainers.properties, which every project shares.
        assertThat(new WindowsDockerPipe().isPersistable()).isFalse();
    }
}
