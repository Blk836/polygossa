package app.lector.video;

import java.time.Duration;
import java.util.List;

public interface ProcessRunner {

    record Ran(int exitCode, String stdout, String stderr) {}

    Ran run(List<String> command, Duration timeout);
}
