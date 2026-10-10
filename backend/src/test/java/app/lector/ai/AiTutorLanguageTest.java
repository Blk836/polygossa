package app.lector.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

class AiTutorLanguageTest {

    private final AiClient ai = mock(AiClient.class);
    private final AiTutor tutor = new AiTutor(ai);
    private final ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);

    @BeforeEach
    void reply() {
        when(ai.completeJson(anyString(), anyString())).thenReturn(JsonMapper.builder().build().readTree("{}"));
    }

    private String prompt() {
        verify(ai).completeJson(system.capture(), anyString());
        return system.getValue();
    }

    @Test
    void definitionsAreWrittenInTheNativeLanguage() {
        tutor.define(Language.DE, NativeLanguage.ES, "Hund", null);
        assertThat(prompt()).contains("Spanish-speaking learners of German").contains("definition\": string (Spanish)")
                .doesNotContain("English");
    }

    @Test
    void englishSpeakersKeepEnglishDefinitions() {
        tutor.define(Language.DE, NativeLanguage.EN, "Hund", null);
        assertThat(prompt()).contains("English-speaking learners of German").contains("(English)");
    }

    @Test
    void examplesAreTranslatedIntoTheNativeLanguage() {
        tutor.example(Language.FR, NativeLanguage.PT, "chat", null);
        assertThat(prompt()).contains("\"translation\": string in Portuguese");
    }

    @Test
    void sentencesAreTranslatedIntoTheNativeLanguage() {
        tutor.translate(Language.JA, NativeLanguage.KO, "猫です");
        assertThat(prompt()).contains("Translate the Japanese text into natural Korean");
    }

    @Test
    void writingFeedbackIsExplainedInTheNativeLanguage() {
        tutor.writingFeedback(Language.IT, NativeLanguage.DE, null, "Ciao");
        assertThat(prompt()).contains("Explanations must be in German");
    }
}
