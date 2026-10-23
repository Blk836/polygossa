package app.lector.video;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class FakeYtDlp implements ProcessRunner {

    private final List<List<String>> commands = new CopyOnWriteArrayList<>();
    private volatile Integer durationSeconds;
    private volatile byte[] audio;
    private volatile String failure;

    public void reset() {
        commands.clear();
        durationSeconds = 600;
        audio = "OggS-fake-opus-audio".getBytes(StandardCharsets.ISO_8859_1);
        failure = null;
    }

    public void setDuration(Integer seconds) {
        durationSeconds = seconds;
    }

    public void setAudio(byte[] bytes) {
        audio = bytes;
    }

    public void fail(String message) {
        failure = message;
    }

    public List<List<String>> commands() {
        return List.copyOf(commands);
    }

    public List<List<String>> downloads() {
        return commands.stream().filter(c -> !c.contains("--skip-download")).toList();
    }

    @Override
    public Ran run(List<String> command, Duration timeout) {
        commands.add(List.copyOf(command));
        if (command.contains("--skip-download")) {
            return durationSeconds == null ? new Ran(1, "", "ERROR: Sign in to confirm you're not a bot")
                    : new Ran(0, durationSeconds + "\n", "");
        }
        if (failure != null) {
            return new Ran(1, "", "WARNING: something\nERROR: " + failure + "\n");
        }
        String output = command.get(command.indexOf("-o") + 1).replace("%(ext)s", "webm");
        try {
            Files.write(Path.of(output), audio);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return new Ran(0, "", "");
    }
}
