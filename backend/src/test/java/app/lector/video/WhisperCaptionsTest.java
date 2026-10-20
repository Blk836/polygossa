package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Language;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class WhisperCaptionsTest {

    private static WhisperCaptions.Heard read(String json, Language language) {
        return WhisperCaptions.read(JsonMapper.builder().build().readTree(json), language);
    }

    @Test
    void eachSegmentIsACueAndEachWordIsMarkedWhereItIsInTheText() {
        var heard = read("""
                {"language":"french","duration":5.2,
                 "segments":[{"start":0.5,"end":2.0,"text":" Bonjour, l'ami !"},{"start":2.0,"end":5.0,"text":" Ça va ?"}],
                 "words":[{"word":"Bonjour","start":0.5},{"word":"l'ami","start":1.2},
                          {"word":"Ça","start":2.1},{"word":"va","start":2.4}]}""", Language.FR);
        assertThat(heard.problem()).isNull();
        assertThat(heard.audioSeconds()).isEqualTo(6);
        assertThat(heard.cues()).extracting(Cue::text).containsExactly("Bonjour, l'ami !", "Ça va ?");
        Cue first = heard.cues().getFirst();
        assertThat(first.startMs()).isEqualTo(500);
        assertThat(first.endMs()).isEqualTo(2000);
        assertThat(first.words()).containsExactly(new WordMark(0, 500), new WordMark(9, 1200));
        assertThat(heard.cues().get(1).words()).containsExactly(new WordMark(0, 2100), new WordMark(3, 2400));
    }

    @Test
    void aWordMissingFromTheTextIsLeftUnmarkedAndTheRestStillMatch() {
        var heard = read("""
                {"language":"spanish","duration":3,
                 "segments":[{"start":0,"end":3,"text":" Son 20 euros."}],
                 "words":[{"word":"Son","start":0.1},{"word":"veinte","start":0.6},{"word":"euros","start":1.2}]}""",
                Language.ES);
        assertThat(heard.cues().getFirst().words()).containsExactly(new WordMark(0, 100), new WordMark(7, 1200));
    }

    @Test
    void wordsAreMatchedRegardlessOfCase() {
        var heard = read("""
                {"language":"german","duration":2,
                 "segments":[{"start":0,"end":2,"text":"Guten Tag"}],
                 "words":[{"word":"guten","start":0.2},{"word":"TAG","start":0.9}]}""", Language.DE);
        assertThat(heard.cues().getFirst().words()).containsExactly(new WordMark(0, 200), new WordMark(6, 900));
    }

    @Test
    void blankSegmentsAreDropped() {
        var heard = read("""
                {"language":"spanish","duration":4,
                 "segments":[{"start":0,"end":1,"text":"  "},{"start":1,"end":4,"text":" Hola."}],
                 "words":[{"word":"Hola","start":1.5}]}""", Language.ES);
        assertThat(heard.cues()).extracting(Cue::text).containsExactly("Hola.");
    }

    @Test
    void nothingHeardIsAProblem() {
        var heard = read("{\"language\":\"spanish\",\"duration\":60,\"segments\":[],\"words\":[]}", Language.ES);
        assertThat(heard.problem()).isEqualTo("no speech found");
        assertThat(heard.audioSeconds()).isEqualTo(60);
    }

    @Test
    void anotherLanguageIsAProblem() {
        var heard = read("""
                {"language":"english","duration":2,"segments":[{"start":0,"end":2,"text":"Hello."}],
                 "words":[{"word":"Hello","start":0}]}""", Language.ES);
        assertThat(heard.problem()).isEqualTo("the speech is English, not Spanish");
    }

    @Test
    void aSegmentWhisperThinksIsNotSpeechIsDropped() {
        var heard = read("""
                {"language":"spanish","duration":9,
                 "segments":[{"start":0,"end":3,"text":" Hola.","no_speech_prob":0.1},
                             {"start":3,"end":9,"text":" Suscríbete.","no_speech_prob":0.95}],
                 "words":[{"word":"Hola","start":0.2},{"word":"Suscríbete","start":4}]}""", Language.ES);
        assertThat(heard.cues()).extracting(Cue::text).containsExactly("Hola.");
    }
}
