package app.lector.token;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class NativeLanguageTest {

    @Test
    void parsesCodesAndRejectsUnknownOnes() {
        assertThat(NativeLanguage.fromCode("es")).isEqualTo(NativeLanguage.ES);
        assertThat(NativeLanguage.fromCode(" PT ")).isEqualTo(NativeLanguage.PT);
        assertThat(NativeLanguage.EN.code()).isEqualTo("en");
        assertThatThrownBy(() -> NativeLanguage.fromCode("xx")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> NativeLanguage.fromCode(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void browserLanguagesFallBackToEnglish() {
        assertThat(NativeLanguage.fromBrowser("pt-BR")).isEqualTo(NativeLanguage.PT);
        assertThat(NativeLanguage.fromBrowser("zh_Hant_TW")).isEqualTo(NativeLanguage.ZH);
        assertThat(NativeLanguage.fromBrowser("fi")).isEqualTo(NativeLanguage.EN);
        assertThat(NativeLanguage.fromBrowser("")).isEqualTo(NativeLanguage.EN);
        assertThat(NativeLanguage.fromBrowser(null)).isEqualTo(NativeLanguage.EN);
    }

    @Test
    void offersEveryLearnableLanguageAndMore() {
        for (Language l : Language.values()) {
            assertThat(NativeLanguage.fromCode(l.code()).code()).isEqualTo(l.code());
        }
        assertThat(NativeLanguage.values().length).isGreaterThan(Language.values().length);
        assertThat(NativeLanguage.fromCode("ru").displayName()).isEqualTo("Russian");
        assertThat(NativeLanguage.fromCode("ru").nativeName()).isEqualTo("Русский");
    }

    @Test
    void acceptsOnlyWordsInTheLanguagesScript() {
        assertThat(NativeLanguage.ZH.writes("狗")).isTrue();
        assertThat(NativeLanguage.ZH.writes("гу")).isFalse();
        assertThat(NativeLanguage.JA.writes("いぬ")).isTrue();
        assertThat(NativeLanguage.JA.writes("犬")).isTrue();
        assertThat(NativeLanguage.KO.writes("개")).isTrue();
        assertThat(NativeLanguage.KO.writes("dog")).isFalse();
        assertThat(NativeLanguage.RU.writes("собака")).isTrue();
        assertThat(NativeLanguage.RU.writes("sobaka")).isFalse();
        assertThat(NativeLanguage.AR.writes("كلب")).isTrue();
        assertThat(NativeLanguage.HI.writes("कुत्ता")).isTrue();
        assertThat(NativeLanguage.ES.writes("perro")).isTrue();
        assertThat(NativeLanguage.ES.writes("perro de agua")).isTrue();
        assertThat(NativeLanguage.ES.writes("狗")).isFalse();
        assertThat(NativeLanguage.ES.writes("")).isFalse();
    }
}
