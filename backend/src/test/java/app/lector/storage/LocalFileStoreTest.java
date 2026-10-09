package app.lector.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;

class LocalFileStoreTest {

    private static final String NAME = "0b4f3b2e-6f2a-4a8e-9a4b-1f2e3d4c5b6a.mp3";

    @TempDir
    Path dir;

    @Test
    void savesOpensAndDeletesAFile() throws IOException {
        LocalFileStore store = new LocalFileStore(dir);
        store.save(NAME, new ByteArrayInputStream(new byte[] {1, 2, 3}), 3, "audio/mpeg");

        FileStore.Opened opened = store.open(NAME, null);
        assertThat(opened.status()).isEqualTo(HttpStatus.OK);
        assertThat(opened.body().getContentAsByteArray()).containsExactly(1, 2, 3);

        store.delete(NAME);
        assertThat(Files.exists(dir.resolve(NAME))).isFalse();
    }

    @Test
    void aMissingFileIsNotThere() {
        assertThat(new LocalFileStore(dir).open(NAME, null)).isNull();
    }

    @Test
    void deletingAMissingFileIsHarmless() {
        new LocalFileStore(dir).delete(NAME);
        assertThat(dir).isEmptyDirectory();
    }
}
