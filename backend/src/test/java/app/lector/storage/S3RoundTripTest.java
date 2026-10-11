package app.lector.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

class S3RoundTripTest {

    @Test
    void theLiveS3CheckPassesAgainstTheStandInAndLeavesNothingBehind() throws Exception {
        try (S3Stub stub = new S3Stub();
             S3Client s3 = S3Client.builder().region(Region.EU_WEST_1).endpointOverride(URI.create(stub.endpoint()))
                     .forcePathStyle(true)
                     .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("a", "b")))
                     .build()) {
            S3RoundTrip.check(new S3FileStore(s3, "uploads"));
            assertThat(stub.objects()).isEmpty();
        }
    }
}
