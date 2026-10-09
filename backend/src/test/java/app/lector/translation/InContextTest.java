package app.lector.translation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import org.junit.jupiter.api.Test;

/** translation-in-context.feature: marking the clicked word in its sentence, and reading the meaning back. */
class InContextTest {

    @Test
    void marksTheWordBetweenTheTextAroundIt() {
        assertThat(InContext.of("Hier, je ", "boitais", " dans la rue.").map(InContext::marked))
                .contains("Hier, je <b>boitais</b> dans la rue.");
    }

    @Test
    void theClickedCopyIsMarkedWhenTheWordAppearsTwice() {
        assertThat(InContext.of("Un os, ", "os", " encore.").map(InContext::marked)).contains("Un os, <b>os</b> encore.");
    }

    @Test
    void specialCharactersAreSentAsText() {
        assertThat(InContext.of("Tom & Jerry <", "boitaient", "> \"vite\"").map(InContext::marked))
                .contains("Tom &amp; Jerry &lt;<b>boitaient</b>&gt; \"vite\"");
    }

    @Test
    void noTextAroundTheWordMeansNoContext() {
        assertThat(InContext.of(null, "os", null)).isEmpty();
        assertThat(InContext.of("  ", "os", " ")).isEmpty();
        assertThat(InContext.of("", "os", "")).isEmpty();
    }

    @Test
    void aLongSentenceIsCutTo500CharactersAroundTheWord() {
        String before = "a".repeat(400) + "B";
        String after = "C" + "z".repeat(400);
        InContext context = InContext.of(before, "os", after).orElseThrow();
        String marked = context.marked();
        assertThat(marked.length() - "<b></b>".length()).isEqualTo(500);
        assertThat(marked).contains("B<b>os</b>C");
        assertThat(marked.indexOf("<b>")).isBetween(240, 260);
    }

    @Test
    void aShortSideLeavesItsShareToTheOther() {
        String marked = InContext.of("Le ", "os", "z".repeat(600)).orElseThrow().marked();
        assertThat(marked).startsWith("Le <b>os</b>");
        assertThat(marked.length() - "<b></b>".length()).isEqualTo(500);
    }

    @Test
    void cuttingNeverSplitsAnEscapeOrCountsItTwice() {
        String marked = InContext.of("&".repeat(600), "os", "").orElseThrow().marked();
        assertThat(marked).isEqualTo("&amp;".repeat(498) + "<b>os</b>");
    }

    @Test
    void readsTheMarkedWords() {
        assertThat(InContext.meaning("Yesterday I <b>was limping</b> in the street.", "boitais"))
                .contains("was limping");
    }

    @Test
    void dropsPunctuationAndSpacesAroundTheMarkedWords() {
        assertThat(InContext.meaning("The dog eats a <b> bone, </b> today.", "os")).contains("bone");
        assertThat(InContext.meaning("<b>«bone»</b>", "os")).contains("bone");
    }

    @Test
    void keepsPunctuationInsideTheMeaning() {
        assertThat(InContext.meaning("He <b>didn't limp</b>.", "boitait")).contains("didn't limp");
    }

    @Test
    void unescapesWhatComesBack() {
        assertThat(InContext.meaning("<b>salt &amp; pepper</b>", "x")).contains("salt & pepper");
    }

    @Test
    void noUsableMarkMeansNoMeaning() {
        assertThat(InContext.meaning("Yesterday I was limping.", "boitais")).isEmpty();
        assertThat(InContext.meaning("Yesterday I <b></b> limped.", "boitais")).isEmpty();
        assertThat(InContext.meaning("I <b> . </b> limped.", "boitais")).isEmpty();
        assertThat(InContext.meaning("<b>was</b> <b>limping</b>", "boitais")).isEmpty();
        assertThat(InContext.meaning("I <b>was limping", "boitais")).isEmpty();
        assertThat(InContext.meaning("I </b>was<b> limping", "boitais")).isEmpty();
        assertThat(InContext.meaning("The <b>Boitais</b> again.", "boitais")).isEmpty();
        assertThat(InContext.meaning(null, "boitais")).isEqualTo(Optional.empty());
    }

    @Test
    void aVeryLongMeaningIsCut() {
        assertThat(InContext.meaning("<b>" + "x".repeat(600) + "</b>", "os")).hasValueSatisfying(m ->
                assertThat(m).hasSize(500));
    }
}
