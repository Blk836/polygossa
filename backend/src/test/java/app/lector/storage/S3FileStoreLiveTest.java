package app.lector.storage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Tag("live")
class S3FileStoreLiveTest {

    @Test
    void savesOpensRangesAndDeletesInTheRealBucket() throws Exception {
        String bucket = System.getenv("LIVE_S3_BUCKET");
        assertThat(bucket).as("set LIVE_S3_BUCKET to the uploads bucket's name").isNotBlank();
        try (S3Client s3 = S3Client.builder().region(Region.EU_WEST_1).build()) {
            S3RoundTrip.check(new S3FileStore(s3, bucket));
        }
    }
}
