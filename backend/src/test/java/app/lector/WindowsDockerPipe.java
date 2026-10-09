package app.lector;

import java.net.URI;
import java.time.Duration;
import org.testcontainers.dockerclient.DockerClientProviderStrategy;
import org.testcontainers.dockerclient.TransportConfig;

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

    @Override
    protected boolean isPersistable() {
        return false;
    }

    @Override
    public String getDescription() {
        return "Docker Desktop's named pipe (npipe://" + pipe + ")";
    }
}
