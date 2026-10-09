package app.lector.storage;

import java.io.InputStream;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

public interface FileStore {

    record Opened(HttpStatus status, Resource body, String contentRange) {

        public ResponseEntity.BodyBuilder response() {
            ResponseEntity.BodyBuilder builder = ResponseEntity.status(status);
            return contentRange == null ? builder : builder.header(HttpHeaders.CONTENT_RANGE, contentRange);
        }
    }

    void save(String name, InputStream content, long length, String contentType);

    Opened open(String name, String range);

    void delete(String name);
}
