package app.lector.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Tag("live")
class S3FileStoreLiveTest {

    private static final byte[] CONTENT = "hello live".getBytes(StandardCharsets.UTF_8);

    private S3Client s3;
    private S3FileStore store;
    private final String name = "live-checks/" + UUID.randomUUID() + ".txt";

    @BeforeEach
    void setUp() {
        String bucket = System.getenv("LIVE_S3_BUCKET");
        assertThat(bucket).as("set LIVE_S3_BUCKET to the uploads bucket's name").isNotBlank();
        s3 = S3Client.builder().region(Region.EU_WEST_1).build();
        store = new S3FileStore(s3, bucket);
    }

    @AfterEach
    void tearDown() {
        if (store != null) {
            store.delete(name);
        }
        if (s3 != null) {
            s3.close();
        }
    }

    private static byte[] read(FileStore.Opened opened) throws Exception {
        try (InputStream in = opened.body().getInputStream()) {
            return in.readAllBytes();
        }
    }

    @Test
    void savesOpensRangesAndDeletesInTheRealBucket() throws Exception {
        store.save(name, new ByteArrayInputStream(CONTENT), CONTENT.length, "text/plain");

        FileStore.Opened whole = store.open(name, null);
        assertThat(whole.status()).isEqualTo(HttpStatus.OK);
        assertThat(read(whole)).isEqualTo(CONTENT);

        FileStore.Opened part = store.open(name, "bytes=0-3");
        assertThat(part.status()).isEqualTo(HttpStatus.PARTIAL_CONTENT);
        assertThat(part.contentRange()).isEqualTo("bytes 0-3/" + CONTENT.length);
        assertThat(read(part)).isEqualTo("hell".getBytes(StandardCharsets.UTF_8));

        store.delete(name);
        assertThat(store.open(name, null)).isNull();
    }
}
