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
    void everyAppSharesOneLoadOfTheShippedLists() {
        VocabMapCatalog another = new VocabMapCatalog();
        assertThat(another.list(Language.FR).orElseThrow()).isSameAs(REAL.list(Language.FR).orElseThrow());
        assertThat(another.blueprint()).isSameAs(REAL.blueprint());
    }

    @Test
    void theRealListsHaveNoProblems() {
        assertThat(REAL.problems()).isEmpty();
    }

    @Test
    void theFrenchListHasEnglishMeaningsAndEveryBandUpToC1() {
        WordList french = REAL.list(Language.FR).orElseThrow();
        assertThat(french.meaningLanguages()).containsExactly(NativeLanguage.EN);
        assertThat(french.bands()).containsExactly("A1", "A2", "B1", "B2", "C1");
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
    void everyAreaOutsideCoreWordsHasB2AndC1Words() {
        WordList french = REAL.list(Language.FR).orElseThrow();
        List<String> themed = REAL.blueprint().regions().stream().filter(r -> !r.id().equals("core"))
                .flatMap(r -> r.areas().stream()).map(Area::id).toList();
        for (String band : List.of("B2", "C1")) {
            List<String> filled = french.words().stream().filter(w -> w.band().equals(band)).map(MapWord::area)
                    .distinct().toList();
            assertThat(filled).as("areas with %s words", band).containsAll(themed);
        }
    }

    @Test
    void aWordAtC2IsReportedAndLeftOut() {
        WordListParser parser = new WordListParser(Language.FR, REAL.blueprint().areaIds());
        parser.parse("fr/c2.words", """
                word | band | area | meaning:en | forms
                pomme | A1 | fruit-veg | apple | pommes
                nonobstant | C2 | opinions | notwithstanding |
                """);
        assertThat(parser.problems()).singleElement()
                .satisfies(p -> assertThat(p).contains("fr/c2.words:3").contains("unknown band \"C2\""));
        assertThat(parser.result().words()).extracting(MapWord::headword).containsExactly("pomme");
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
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:3").contains("\"pomme\" appears twice"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:4").contains("unknown area \"nowhere\""));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:5").contains("unknown band \"Z9\""));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:6").contains("copies the word"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:8").contains("no en meaning"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:9")
                .contains("\"pommes\" already belongs to \"pomme\""));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:10").contains("\"la_porte\" is not one word"));
        assertThat(problems).anySatisfy(p -> assertThat(p).contains("bad.words:11").contains("expected 5 columns"));
        assertThat(problems).noneSatisfy(p -> assertThat(p).contains("bad.words:7"));
        assertThat(problems).hasSize(8);
    }

    @Test
    void anApostropheJoinsAWordButAnElidedFormIsNotOne() {
        VocabMapCatalog catalog = fixture("apostrophes");
        assertThat(catalog.problems()).singleElement().satisfies(p -> assertThat(p).contains("a.words:3")
                .contains("\"j'\" is not one word"));
        assertThat(catalog.list(Language.FR).orElseThrow().words()).extracting(MapWord::headword)
                .contains("aujourd'hui");
    }

    @Test
    void theRealListsHaveNoElidedForms() {
        List<String> forms = REAL.list(Language.FR).orElseThrow().words().stream()
                .flatMap(w -> w.forms().stream()).toList();
        assertThat(forms).noneMatch(form -> form.endsWith("'") || form.endsWith("’"));
    }

    @Test
    void aFileWithAWrongHeaderOrDifferentMeaningColumnsIsLeftOut() {
        VocabMapCatalog catalog = fixture("badheader");
        assertThat(catalog.problems()).containsExactlyInAnyOrder(
                "fr/a.words:1: the header must be word, band, area, the same meaning columns in every file, then forms",
                "fr/c.words:1: the header must be word, band, area, the same meaning columns in every file, then forms");
        assertThat(catalog.list(Language.FR).orElseThrow().words()).extracting(MapWord::headword)
                .containsExactly("poire");
        assertThat(catalog.list(Language.FR).orElseThrow().meaningLanguages()).containsExactly(NativeLanguage.EN);
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
        return new VocabMapCatalog(VocabMapCatalog.BLUEPRINT, "classpath*:vocabmap-test/" + name + "/*/*.words");
    }
}
