package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

class SystemProcessRunnerTest {

    private final SystemProcessRunner runner = new SystemProcessRunner();
    private final String java = ProcessHandle.current().info().command().orElseThrow();

    @Test
    void aProgramThatIsntInstalledSaysSo() {
        ProcessRunner.Ran ran = runner.run(List.of("no-such-program-polygossa"), Duration.ofSeconds(10));
        assertThat(ran.exitCode()).isEqualTo(SystemProcessRunner.NOT_STARTED);
        assertThat(ran.stderr()).isEqualTo("no-such-program-polygossa not found");
    }

    @Test
    void theExitCodeAndOutputAreKept() {
        ProcessRunner.Ran ran = runner.run(List.of(java, "-version"), Duration.ofSeconds(30));
        assertThat(ran.exitCode()).isZero();
        assertThat(ran.stderr()).contains("version");
        assertThat(runner.run(List.of(java, "-no-such-option"), Duration.ofSeconds(30)).exitCode()).isNotZero();
    }

    @Test
    void theLastLineOfAnErrorIsTheReason() {
        assertThat(YtDlpClient.lastLine("WARNING: x\r\nERROR: Video unavailable\n\n")).contains("ERROR: Video unavailable");
        assertThat(YtDlpClient.lastLine(" \n")).isEmpty();
    }

    @Test
    void productionNeverDownloadsAudio() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application-prod.yml"));
        assertThat(yaml.getObject().getProperty("app.youtube.audio.enabled")).isEqualTo("false");
    }
}
