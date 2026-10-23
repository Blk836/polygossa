package app.lector.video;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class SystemProcessRunner implements ProcessRunner {

    static final int NOT_STARTED = -1;
    static final int TIMED_OUT = -2;

    @Override
    public Ran run(List<String> command, Duration timeout) {
        Path out = null;
        Path err = null;
        try {
            out = Files.createTempFile("polygossa-run-", ".out");
            err = Files.createTempFile("polygossa-run-", ".err");
            Process process = new ProcessBuilder(command).redirectOutput(out.toFile()).redirectError(err.toFile())
                    .redirectInput(ProcessBuilder.Redirect.from(nullDevice())).start();
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.descendants().forEach(ProcessHandle::destroyForcibly);
                process.destroyForcibly();
                return new Ran(TIMED_OUT, "", command.getFirst() + " took longer than " + timeout.toSeconds() + " s");
            }
            return new Ran(process.exitValue(), Files.readString(out, StandardCharsets.UTF_8),
                    Files.readString(err, StandardCharsets.UTF_8));
        } catch (IOException e) {
            return new Ran(NOT_STARTED, "", command.getFirst() + " not found");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Ran(NOT_STARTED, "", "interrupted");
        } finally {
            delete(out);
            delete(err);
        }
    }

    private static java.io.File nullDevice() {
        return new java.io.File(System.getProperty("os.name").startsWith("Windows") ? "NUL" : "/dev/null");
    }

    private static void delete(Path path) {
        if (path != null) {
            try {
                Files.deleteIfExists(path);
            } catch (IOException e) {
                path.toFile().deleteOnExit();
            }
        }
    }
}
