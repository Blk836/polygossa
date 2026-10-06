package app.lector.storage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Recognising profile photos by their first bytes. */
class PhotoTypeTest {

    @Test
    void exactlyTheMagicBytesAreEnough() {
        assertThat(PhotoType.of(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})).isEqualTo("jpg");
        assertThat(PhotoType.of(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'})).isEqualTo("png");
    }

    @Test
    void anythingShorterOrDifferentIsNotAPhoto() {
        assertThat(PhotoType.of(new byte[] {(byte) 0xFF, (byte) 0xD8})).isNull();
        assertThat(PhotoType.of(new byte[0])).isNull();
        assertThat(PhotoType.of(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, 'x'})).isNull();
    }

    @Test
    void mediaTypeFollowsTheStoredExtension() {
        assertThat(PhotoType.mediaType("a.png")).isEqualTo("image/png");
        assertThat(PhotoType.mediaType("a.jpg")).isEqualTo("image/jpeg");
    }
}
