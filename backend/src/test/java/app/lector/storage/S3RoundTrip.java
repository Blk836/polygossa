package app.lector.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.HttpStatus;

final class S3RoundTrip {

    private static final byte[] CONTENT = "hello live".getBytes(StandardCharsets.UTF_8);

    private S3RoundTrip() {
    }

    static void check(S3FileStore store) throws Exception {
        String name = "live-checks/" + UUID.randomUUID() + ".txt";
        try {
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
        } finally {
            store.delete(name);
        }
    }

    private static byte[] read(FileStore.Opened opened) throws Exception {
        try (InputStream in = opened.body().getInputStream()) {
            return in.readAllBytes();
        }
    }
}
