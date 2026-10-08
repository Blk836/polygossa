package app.lector.storage;

import java.io.InputStream;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** Where uploaded files' bytes live: a local folder, or an S3 bucket in production. Names are already checked. */
public interface FileStore {

    /**
     * An opened file. {@code contentRange} is set when the store answered a range itself (S3, status 206); a local
     * file's ranges are left to Spring, which answers them for any {@link Resource} body served with status 200.
     */
    record Opened(HttpStatus status, Resource body, String contentRange) {

        /** A response with this file's status and, for a part, the range it holds; the caller adds the body. */
        public ResponseEntity.BodyBuilder response() {
            ResponseEntity.BodyBuilder builder = ResponseEntity.status(status);
            return contentRange == null ? builder : builder.header(HttpHeaders.CONTENT_RANGE, contentRange);
        }
    }

    void save(String name, InputStream content, long length, String contentType);

    /** The file, or the part {@code range} (an HTTP Range header, may be null) asks for; null when it doesn't exist. */
    Opened open(String name, String range);

    /** Deletes the file if it exists. */
    void delete(String name);
}
