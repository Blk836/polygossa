package app.lector.vocabmap;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.vocabmap.VocabMapCatalog.Area;
import app.lector.vocabmap.VocabMapCatalog.MapWord;
import app.lector.vocabmap.VocabMapCatalog.WordList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The blueprint and the word lists that fill it (vocabulary-map.feature, "Keeping the list right"). */
class VocabMapCatalogTest {

    private static final VocabMapCatalog REAL = new VocabMapCatalog();

    private static final Map<String, Integer> BAND_TARGETS = Map.of("A1", 500, "A2", 1000, "B1", 2000, "B2", 4000,
            "C1", 8000);

    @Test
    void theBlueprintHas14RegionsWithUniqueAreas() {
        assertThat(REAL.blueprint().regions()).hasSize(14);
        List<String> areas = REAL.blueprint().regions().stream()
                .flatMap(r -> r.areas().stream()).map(Area::id).toList();
        assertThat(areas).doesNotHaveDuplicates().allSatisfy(id -> assertThat(id).matches("[a-z0-9-]+"));
        assertThat(REAL.blueprint().regions()).allSatisfy(r -> assertThat(r.areas()).isNotEmpty());
    }

    @Test
    void theRealListsHaveNoProblems() {
        assertThat(REAL.problems()).isEmpty();
    }

    @Test
    void theMvpHasAFrenchListWithEnglishMeaningsUpToB1() {
        WordList french = REAL.list(Language.FR).orElseThrow();
        assertThat(french.meaningLanguages()).containsExactly(NativeLanguage.EN);
        assertThat(french.bands()).containsExactly("A1", "A2", "B1");
        assertThat(french.words()).allSatisfy(w -> assertThat(w.meanings().get(NativeLanguage.EN)).isNotBlank());
        assertThat(REAL.list(Language.ES)).isEmpty();
    }

    @Test
    void eachBandIsWithin15PercentOfItsTarget() {
        for (Language language : Language.values()) {
            REAL.list(language).ifPresent(list -> {
                for (String band : list.bands()) {
                    int target = BAND_TARGETS.get(band);
                    assertThat(list.cumulative(band)).as("%s up to %s", language, band)
                            .isBetween((int) (target * 0.85), (int) (target * 1.15));
                }
            });
        }
    }

    @Test
    void everyAreaHasAWordUpToB1() {
        for (Language language : Language.values()) {
            REAL.list(language).ifPresent(list ->
                    assertThat(list.emptyAreas(REAL.blueprint(), "B1")).as("%s", language).isEmpty());
        }
    }

    @Test
    void formsIncludeTheHeadwordAndAreNormalised() {
        MapWord word = REAL.list(Language.FR).orElseThrow().words().stream()
                .filter(w -> w.headword().equals("manger")).findFirst().orElseThrow();
        assertThat(word.forms()).contains("manger", "mange", "mangé");
    }

    @Test
    void aMeaningMarkedSameIsTheWordItself() {
        VocabMapCatalog bad = fixture("bad");
        MapWord bus = bad.list(Language.FR).orElseThrow().words().stream()
                .filter(w -> w.headword().equals("bus")).findFirst().orElseThrow();
        assertThat(bus.meanings()).containsEntry(NativeLanguage.EN, "bus");
    }

    @Test
    void everyKindOfMistakeInAListIsReported() {
        List<String> problems = fixture("bad").problems();
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:3").contains("\"pomme\" appears twice"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:4").contains("unknown area \"nowhere\""));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:5").contains("unknown band \"Z9\""));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:6").contains("copies the word"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:8").contains("no en meaning"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:9")
                .contains("\"pommes\" already belongs to \"pomme\""));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:10").contains("\"la_porte\" is not one word"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.tsv:11").contains("expected 5 columns"));
        assertThat(problems).noneSatisfy(p -> assertThat(p).contains("bad.tsv:7"));
        assertThat(problems).hasSize(8);
    }

    @Test
    void aNewLanguageNeedsOnlyAList() {
        VocabMapCatalog withSpanish = fixture("good");
        assertThat(withSpanish.problems()).isEmpty();
        WordList spanish = withSpanish.list(Language.ES).orElseThrow();
        assertThat(withSpanish.blueprint()).isEqualTo(REAL.blueprint());
        assertThat(spanish.words()).extracting(MapWord::headword).containsExactly("manzana", "comer", "banco");
        assertThat(spanish.bands()).containsExactly("A1", "A2");
    }

    @Test
    void bandsStopAtTheFirstMissingOne() {
        WordList list = new WordList(Language.ES, List.of(NativeLanguage.EN), List.of(
                word("a", "A1"), word("b", "B1")));
        assertThat(list.bands()).containsExactly("A1");
        assertThat(new WordList(Language.ES, List.of(), List.of(word("b", "A2"))).bands()).isEmpty();
    }

    @Test
    void cumulativeCountsIncludeLowerBands() {
        WordList list = new WordList(Language.ES, List.of(), List.of(word("a", "A1"), word("b", "A2"),
                word("c", "A2"), word("d", "B1")));
        assertThat(list.cumulative("A1")).isEqualTo(1);
        assertThat(list.cumulative("A2")).isEqualTo(3);
        assertThat(list.cumulative("B1")).isEqualTo(4);
    }

    @Test
    void emptyAreasLooksOnlyAtBandsUpToTheGivenOne() {
        WordList list = new WordList(Language.ES, List.of(), List.of(
                new MapWord("a", "A1", "family", Map.of(), java.util.Set.of("a")),
                new MapWord("b", "B2", "weather", Map.of(), java.util.Set.of("b"))));
        List<String> empty = list.emptyAreas(REAL.blueprint(), "B1");
        assertThat(empty).doesNotContain("family").contains("weather");
    }

    private static MapWord word(String headword, String band) {
        return new MapWord(headword, band, "family", Map.of(), java.util.Set.of(headword));
    }

    private static VocabMapCatalog fixture(String name) {
        return new VocabMapCatalog(VocabMapCatalog.BLUEPRINT, "classpath*:vocabmap-test/" + name + "/*/*.tsv");
    }
}
