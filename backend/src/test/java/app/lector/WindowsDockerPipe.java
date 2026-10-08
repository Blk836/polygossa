package app.lector;

import java.net.URI;
import java.time.Duration;
import org.testcontainers.dockerclient.DockerClientProviderStrategy;
import org.testcontainers.dockerclient.TransportConfig;

/** Finds Docker Desktop's named pipe on Windows (docs/acceptance/postgres.feature). */
public class WindowsDockerPipe extends DockerClientProviderStrategy {

    static final String DOCKER_PIPE = "//./pipe/docker_engine";

    private final String pipe;

    public WindowsDockerPipe() {
        this(DOCKER_PIPE, Duration.ofSeconds(5));
    }

    WindowsDockerPipe(String pipe, Duration wait) {
        this.pipe = pipe;
    }

    @Override
    public TransportConfig getTransportConfig() {
        return TransportConfig.builder().dockerHost(URI.create("npipe://" + pipe)).build();
    }

    @Override
    protected boolean test() {
        return super.test();
    }

    @Override
    protected boolean isApplicable() {
        return System.getProperty("os.name").startsWith("Windows");
    }

    @Override
    protected boolean isPersistable() {
        return super.isPersistable();
    }

    @Override
    public String getDescription() {
        return "Docker Desktop's named pipe (npipe:" + pipe + ")";
    }
}
