package app.lector.storage;

import app.lector.config.AppProperties;
import java.net.URI;
import java.nio.file.Path;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;

/** Picks where uploads live: the S3 bucket when {@code app.storage.s3-bucket} is set (production), else the folder. */
@Configuration
public class StorageConfig {

    @Bean
    FileStore fileStore(AppProperties props) {
        AppProperties.Storage storage = props.storage();
        if (storage.s3Bucket().isBlank()) {
            return new LocalFileStore(Path.of(storage.dir()));
        }
        // Credentials come from the SDK's default chain: the task's role on AWS.
        S3ClientBuilder client = S3Client.builder().region(Region.of(storage.s3Region()));
        if (!storage.s3Endpoint().isBlank()) {
            client.endpointOverride(URI.create(storage.s3Endpoint())).forcePathStyle(true);
        }
        return new S3FileStore(client.build(), storage.s3Bucket());
    }
}
