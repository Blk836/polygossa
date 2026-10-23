package app.lector.video;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class YtDlpClient {

    public record Audio(byte[] bytes, String filename) {}

    public record Download(Audio audio, long sizeBytes, String failure) {}

    private static final String FORMAT = "249/250/wa[ext=webm]/wa";

    private final boolean enabled;
    private final String command;
    private final String cookiesFromBrowser;
    private final Duration timeout;
    private final ProcessRunner runner;

    public YtDlpClient(@Value("${app.youtube.audio.enabled:false}") boolean enabled,
                       @Value("${app.youtube.audio.yt-dlp:yt-dlp}") String command,
                       @Value("${app.youtube.audio.cookies-from-browser:}") String cookiesFromBrowser,
                       @Value("${app.youtube.audio.timeout:5m}") Duration timeout,
                       ProcessRunner runner) {
        this.enabled = enabled;
        this.command = command;
        this.cookiesFromBrowser = cookiesFromBrowser == null ? "" : cookiesFromBrowser.strip();
        this.timeout = timeout;
        this.runner = runner;
    }

    public boolean enabled() {
        return enabled;
    }

    public Optional<Integer> durationSeconds(String videoId) {
        List<String> args = common();
        args.addAll(List.of("--skip-download", "--print", "duration", YouTubeUrls.watchUrl(videoId)));
        ProcessRunner.Ran ran = runner.run(args, timeout);
        if (ran.exitCode() != 0) {
            return Optional.empty();
        }
        try {
            long seconds = Math.round(Double.parseDouble(ran.stdout().strip()));
            return seconds > 0 && seconds <= Integer.MAX_VALUE ? Optional.of((int) seconds) : Optional.empty();
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public Download download(String videoId, long maxBytes) {
        Path dir = null;
        try {
            dir = Files.createTempDirectory("polygossa-audio-");
            List<String> args = common();
            args.addAll(List.of("-f", FORMAT, "-o", dir.resolve("audio.%(ext)s").toString(),
                    YouTubeUrls.watchUrl(videoId)));
            ProcessRunner.Ran ran = runner.run(args, timeout);
            if (ran.exitCode() != 0) {
                return failed(lastLine(ran.stderr()).orElse("yt-dlp exited with " + ran.exitCode()));
            }
            Optional<Path> file = saved(dir);
            if (file.isEmpty()) {
                return failed("yt-dlp saved no audio");
            }
            long size = Files.size(file.get());
            if (size > maxBytes) {
                return new Download(null, size, null);
            }
            return new Download(new Audio(Files.readAllBytes(file.get()), file.get().getFileName().toString()), size,
                    null);
        } catch (IOException e) {
            return failed("couldn't save the audio");
        } finally {
            deleteAll(dir);
        }
    }

    private List<String> common() {
        List<String> args = new ArrayList<>(List.of(command, "--quiet", "--no-warnings", "--no-playlist",
                "--js-runtimes", "node"));
        if (!cookiesFromBrowser.isEmpty()) {
            args.addAll(List.of("--cookies-from-browser", cookiesFromBrowser));
        }
        return args;
    }

    private static Download failed(String why) {
        return new Download(null, 0, why);
    }

    private static Optional<Path> saved(Path dir) throws IOException {
        try (Stream<Path> files = Files.list(dir)) {
            return files.filter(p -> p.getFileName().toString().startsWith("audio.")).findFirst();
        }
    }

    static Optional<String> lastLine(String text) {
        List<String> lines = Arrays.stream(text.split("\\R")).map(String::strip).filter(l -> !l.isEmpty()).toList();
        return lines.isEmpty() ? Optional.empty() : Optional.of(lines.getLast());
    }

    private static void deleteAll(Path dir) {
        if (dir == null) {
            return;
        }
        try (Stream<Path> paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException e) {
            dir.toFile().deleteOnExit();
        }
    }
}
