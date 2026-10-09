package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.time.Duration;
import java.util.ServiceLoader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.testcontainers.dockerclient.DockerClientProviderStrategy;

class WindowsDockerPipeTest {

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void findsDockerRightAfterSomeoneElseUsedThePipe() {
        for (int i = 0; i < 20; i++) {
            new File(WindowsDockerPipe.DOCKER_PIPE).exists();
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
        assertThat(new WindowsDockerPipe().isPersistable()).isFalse();
    }
}
