package app.lector;

import java.net.URI;
import java.time.Duration;
import org.testcontainers.dockerclient.DockerClientProviderStrategy;
import org.testcontainers.dockerclient.TransportConfig;

/**
 * Finds Docker Desktop's named pipe on Windows even while it is busy (docs/acceptance/postgres.feature).
 * Testcontainers' own strategies check once that the pipe exists, and on Windows that check fails right after
 * anyone else used the pipe (another test JVM starting, Testcontainers' cleanup container, the Docker CLI); a JVM
 * that loses that race then fails every test it runs. This one checks again for a few seconds. Testcontainers tries
 * it after its own (registered in META-INF/services), so it only matters when they failed.
 */
public class WindowsDockerPipe extends DockerClientProviderStrategy {

    static final String DOCKER_PIPE = "//./pipe/docker_engine";
    private static final Duration PAUSE = Duration.ofMillis(50);

    private final String pipe;
    private final Duration wait;

    public WindowsDockerPipe() {
        this(DOCKER_PIPE, Duration.ofSeconds(5));
    }

    WindowsDockerPipe(String pipe, Duration wait) {
        this.pipe = pipe;
        this.wait = wait;
    }

    @Override
    public TransportConfig getTransportConfig() {
        return TransportConfig.builder().dockerHost(URI.create("npipe://" + pipe)).build();
    }

    @Override
    protected boolean test() {
        long deadline = System.nanoTime() + wait.toNanos();
        while (!super.test()) {
            if (System.nanoTime() >= deadline) {
                return false;
            }
            try {
                Thread.sleep(PAUSE);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return true;
    }

    @Override
    protected boolean isApplicable() {
        return System.getProperty("os.name").startsWith("Windows");
    }

    /** Never written to ~/.testcontainers.properties: every project shares that file, and this class is ours. */
    @Override
    protected boolean isPersistable() {
        return false;
    }

    @Override
    public String getDescription() {
        return "Docker Desktop's named pipe (npipe://" + pipe + ")";
    }
}
