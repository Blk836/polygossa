package app.lector.storage;

import app.lector.common.ApiException;
import app.lector.config.AppProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Stores uploaded files (audio) on local disk under {@code app.storage.dir}. */
@Service
public class StorageService {

    private static final Pattern SAFE_NAME = Pattern.compile("[a-f0-9\\-]{36}\\.[a-z0-9]{1,5}");
    private static final Pattern EXTENSION = Pattern.compile("\\.([A-Za-z0-9]{1,5})$");

    private final Path root;

    public StorageService(AppProperties props) {
        this.root = Path.of(props.storage().dir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot create storage directory " + root, e);
        }
    }

    /** Saves an audio upload and returns its stored name. */
    public String saveAudio(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !(contentType.startsWith("audio/") || contentType.equals("video/mp4")
                || contentType.equals("video/webm") || contentType.equals("application/ogg"))) {
            throw ApiException.badRequest("Please upload an audio file (mp3, m4a, ogg, wav, webm)");
        }
        if (file.isEmpty()) {
            throw ApiException.badRequest("The uploaded file is empty");
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        var m = EXTENSION.matcher(original);
        String ext = m.find() ? m.group(1).toLowerCase(Locale.ROOT) : "bin";
        String name = UUID.randomUUID() + "." + ext;
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, root.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store upload", e);
        }
        return name;
    }

    public Resource load(String name) {
        return new FileSystemResource(resolve(name));
    }

    public void delete(String name) {
        if (name == null) {
            return;
        }
        try {
            Files.deleteIfExists(resolve(name));
        } catch (IOException ignored) {
            // Orphaned files are harmless; nothing else to do.
        }
    }

    private Path resolve(String name) {
        if (!SAFE_NAME.matcher(name).matches()) {
            throw ApiException.notFound("File");
        }
        return root.resolve(name);
    }
}
