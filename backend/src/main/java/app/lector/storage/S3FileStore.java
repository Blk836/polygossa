package app.lector.storage;

import app.lector.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

public class S3FileStore implements FileStore {

    private static final Logger log = LoggerFactory.getLogger(S3FileStore.class);
    private static final int RANGE_NOT_SATISFIABLE = 416;

    private final S3Client s3;
    private final String bucket;

    public S3FileStore(S3Client s3, String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    @Override
    public void save(String name, InputStream content, long length, String contentType) {
        try (content) {
            s3.putObject(b -> b.bucket(bucket).key(name).contentType(contentType),
                    RequestBody.fromInputStream(content, length));
        } catch (SdkException e) {
            log.warn("Could not store {} in S3: {}", name, e.getMessage());
            throw unavailable();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read upload", e);
        }
    }

    @Override
    public Opened open(String name, String range) {
        GetObjectRequest.Builder request = GetObjectRequest.builder().bucket(bucket).key(name);
        if (range != null && range.startsWith("bytes=")) {
            request.range(range);
        }
        try {
            ResponseInputStream<GetObjectResponse> object = s3.getObject(request.build());
            GetObjectResponse meta = object.response();
            HttpStatus status = meta.contentRange() == null ? HttpStatus.OK : HttpStatus.PARTIAL_CONTENT;
            return new Opened(status, new StreamedFile(object, meta.contentLength(), name), meta.contentRange());
        } catch (NoSuchKeyException e) {
            return null;
        } catch (S3Exception e) {
            if (e.statusCode() == RANGE_NOT_SATISFIABLE) {
                return new Opened(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, null, null);
            }
            log.warn("Could not read {} from S3: {}", name, e.getMessage());
            throw unavailable();
        } catch (SdkException e) {
            log.warn("Could not read {} from S3: {}", name, e.getMessage());
            throw unavailable();
        }
    }

    @Override
    public void delete(String name) {
        try {
            s3.deleteObject(b -> b.bucket(bucket).key(name));
        } catch (SdkException e) {
            log.warn("Could not delete {} from S3: {}", name, e.getMessage());
        }
    }

    private static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "storage_unavailable",
                "Couldn't save the file. Please try again.");
    }
}
