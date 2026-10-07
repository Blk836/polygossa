package app.lector.storage;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;

/** Uploads in a local folder: local runs (QA) and tests. Spring answers Range requests for these files itself. */
public class LocalFileStore implements FileStore {

    private final Path root;

    public LocalFileStore(Path root) {
        this.root = root.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot create storage directory " + this.root, e);
        }
    }

    @Override
    public void save(String name, InputStream content, long length, String contentType) {
        try (content) {
            Files.copy(content, root.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store upload", e);
        }
    }

    @Override
    public Opened open(String name, String range) {
        Path file = root.resolve(name);
        return Files.isRegularFile(file) ? new Opened(HttpStatus.OK, new FileSystemResource(file), -1, null) : null;
    }

    @Override
    public void delete(String name) {
        try {
            Files.deleteIfExists(root.resolve(name));
        } catch (IOException ignored) {
            // Orphaned files are harmless; nothing else to do.
        }
    }
}
