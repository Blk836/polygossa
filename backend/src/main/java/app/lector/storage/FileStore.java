package app.lector.storage;

import java.io.InputStream;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;

/** Where uploaded files' bytes live: a local folder, or an S3 bucket in production. Names are already checked. */
public interface FileStore {

    /**
     * An opened file. {@code length} and {@code contentRange} are set when the store answered a range itself (S3);
     * a local file's ranges are left to Spring ({@code length} -1).
     */
    record Opened(HttpStatus status, Resource body, long length, String contentRange) {}

    void save(String name, InputStream content, long length, String contentType);

    /** The file, or the part {@code range} (an HTTP Range header, may be null) asks for; null when it doesn't exist. */
    Opened open(String name, String range);

    /** Deletes the file if it exists. */
    void delete(String name);
}
