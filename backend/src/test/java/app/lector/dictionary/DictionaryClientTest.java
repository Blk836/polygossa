package app.lector.dictionary;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class DictionaryClientTest {

    @Test
    void extractsLemmaFromFormOfDefinitions() {
        assertThat(DictionaryClient.lemmaFrom("inflection of casar:", "casa")).isEqualTo("casar");
        assertThat(DictionaryClient.lemmaFrom("plural of mañana", "mañanas")).isEqualTo("mañana");
        assertThat(DictionaryClient.lemmaFrom("third-person singular present indicative of comer", "come"))
                .isEqualTo("comer");
        assertThat(DictionaryClient.lemmaFrom("a type of bird", "pájaro")).isNull();
        assertThat(DictionaryClient.lemmaFrom("house", "casa")).isNull();
    }

    private static String pronunciation(String json) {
        return DictionaryClient.preferredPronunciation(JsonMapper.builder().build().readTree(json));
    }

    @Test
    void prefersIpaOtherwiseTheFirstPronunciation() {
        assertThat(pronunciation("[{\"type\":\"enPR\",\"text\":\"a\"},{\"type\":\"ipa\",\"text\":\"/b/\"}]")).isEqualTo("/b/");
        assertThat(pronunciation("[{\"type\":\"enPR\",\"text\":\"a\"},{\"type\":\"other\",\"text\":\"c\"}]")).isEqualTo("a");
        assertThat(pronunciation("[]")).isNull();
    }
}
