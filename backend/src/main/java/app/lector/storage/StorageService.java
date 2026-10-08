package app.lector.storage;

import app.lector.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** Checks and names uploaded files (audio, profile photos) and keeps them in the {@link FileStore}. */
@Service
public class StorageService {

    private static final Pattern SAFE_NAME = Pattern.compile("[a-f0-9\\-]{36}\\.[a-z0-9]{1,5}");
    private static final Pattern EXTENSION = Pattern.compile("\\.([A-Za-z0-9]{1,5})$");

    static final long MAX_PHOTO_BYTES = 1024 * 1024;

    private final FileStore store;

    public StorageService(FileStore store) {
        this.store = store;
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
        try {
            store.save(name, file.getInputStream(), file.getSize(), contentType);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read upload", e);
        }
        return name;
    }

    /**
     * Saves a profile photo and returns its stored name. The type comes from the file's first bytes, never from its
     * name or declared type, so only real PNGs and JPEGs are stored.
     */
    public String savePhoto(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > MAX_PHOTO_BYTES) {
            throw ApiException.badRequest("Please upload a JPEG or PNG image of at most 1 MB");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read upload", e);
        }
        String ext = PhotoType.of(bytes);
        if (ext == null) {
            throw ApiException.badRequest("Please upload a JPEG or PNG image");
        }
        String name = UUID.randomUUID() + "." + ext;
        store.save(name, new ByteArrayInputStream(bytes), bytes.length, PhotoType.mediaType(name));
        return name;
    }

    /**
     * The stored file, or the part an HTTP Range header asks for ({@code range} may be null); "{what} not found"
     * when it no longer exists.
     */
    public FileStore.Opened open(String name, String range, String what) {
        FileStore.Opened opened = SAFE_NAME.matcher(name).matches() ? store.open(name, range) : null;
        if (opened == null) {
            throw ApiException.notFound(what);
        }
        return opened;
    }

    public void delete(String name) {
        if (name != null && SAFE_NAME.matcher(name).matches()) {
            store.delete(name);
        }
    }
}
