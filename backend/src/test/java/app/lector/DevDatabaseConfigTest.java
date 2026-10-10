package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

class DevDatabaseConfigTest {

    private static final Path COMPOSE = Path.of("..", "compose.dev.yml");

    private static Object devDefault(String key) throws IOException {
        List<PropertySource<?>> yaml = new YamlPropertySourceLoader()
                .load("application", new ClassPathResource("application.yml"));
        return yaml.getFirst().getProperty(key);
    }

    @Test
    void theBackendDefaultsToTheDevPostgres() throws IOException {
        assertThat(devDefault("spring.datasource.url").toString())
                .isEqualTo("${DATABASE_URL:jdbc:postgresql://localhost:5432/lector}");
    }

    @Test
    void bootRunStartsTheDevDatabaseFromTheComposeFile() throws IOException {
        assertThat(devDefault("spring.docker.compose.file").toString()).endsWith("../compose.dev.yml}");
        assertThat(devDefault("spring.docker.compose.lifecycle-management")).isEqualTo("start-only");
    }

    @Test
    void theComposeFileRunsPostgres17WithAPersistentVolume() throws IOException {
        String compose = Files.readString(COMPOSE);
        assertThat(compose)
                .contains("image: postgres:17")
                .contains("container_name: polygossa-dev-db")
                .contains("\"5432:5432\"")
                .contains("POSTGRES_DB: lector")
                .containsPattern("- [\\w-]+:/var/lib/postgresql/data");
    }

    @Test
    void h2IsNotOnTheClasspath() {
        assertThatThrownBy(() -> Class.forName("org.h2.Driver")).isInstanceOf(ClassNotFoundException.class);
    }
}
