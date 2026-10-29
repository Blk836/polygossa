package app.lector.translation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

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
}
