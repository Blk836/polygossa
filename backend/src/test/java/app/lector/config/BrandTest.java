package app.lector.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BrandTest {

    @Test
    void blankOrMissingNameFallsBackToPolygossa() {
        assertThat(new Brand(null).name()).isEqualTo("Polygossa");
        assertThat(new Brand("").name()).isEqualTo("Polygossa");
        assertThat(new Brand("   ").name()).isEqualTo("Polygossa");
    }

    @Test
    void configuredNameIsTrimmedAndNamesTheLibrary() {
        Brand brand = new Brand("  Acme Read ");
        assertThat(brand.name()).isEqualTo("Acme Read");
        assertThat(brand.libraryName()).isEqualTo("Acme Read Library");
    }
}
