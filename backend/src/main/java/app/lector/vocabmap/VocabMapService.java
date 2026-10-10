package app.lector.vocabmap;

import app.lector.level.SkillLevelService;
import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.user.User;
import app.lector.vocab.EntryKind;
import app.lector.vocab.TermEntry;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import app.lector.vocabmap.VocabMapCatalog.Area;
import app.lector.vocabmap.VocabMapCatalog.MapWord;
import app.lector.vocabmap.VocabMapCatalog.Region;
import app.lector.vocabmap.VocabMapCatalog.WordList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabMapService {

    public record WordDto(String term, String band, WordStatus status, String meaning) {}

    public record AreaDto(String id, String name, List<WordDto> words) {}

    public record RegionDto(String id, String name, List<AreaDto> areas) {}

    public record VocabMap(Language language, boolean available, String readingLevel, List<String> bands,
                           NativeLanguage meaningLanguage, int beyondCore, List<RegionDto> regions) {}

    private final VocabMapCatalog catalog;
    private final VocabularyRepository vocabulary;
    private final SkillLevelService levels;

    public VocabMapService(VocabMapCatalog catalog, VocabularyRepository vocabulary, SkillLevelService levels) {
        this.catalog = catalog;
        this.vocabulary = vocabulary;
        this.levels = levels;
    }

    @Transactional(readOnly = true)
    public VocabMap map(User user, Language language) {
        NativeLanguage nativeLanguage = user.getNativeLanguage();
        WordList list = catalog.list(language).orElse(null);
        if (list == null) {
            return new VocabMap(language, false, null, List.of(), nativeLanguage, 0, List.of());
        }
        Map<String, TermEntry> entries = new HashMap<>();
        for (TermEntry e : vocabulary.findTermEntries(user.getId(), language)) {
            if (e.kind() == EntryKind.WORD) {
                entries.put(e.term(), e);
            }
        }
        Map<String, List<MapWord>> byArea = new HashMap<>();
        Set<String> allForms = new HashSet<>();
        for (MapWord w : list.words()) {
            byArea.computeIfAbsent(w.area(), a -> new java.util.ArrayList<>()).add(w);
            allForms.addAll(w.forms());
        }
        List<RegionDto> regions = catalog.blueprint().regions().stream()
                .map(r -> region(r, byArea, entries, nativeLanguage)).toList();
        int beyond = (int) entries.values().stream()
                .filter(e -> e.status() == WordStatus.KNOWN && !allForms.contains(e.term())).count();
        String reading = levels.levels(user, language).reading().level();
        return new VocabMap(language, true, reading, list.bands(), nativeLanguage, beyond, regions);
    }

    private static RegionDto region(Region region, Map<String, List<MapWord>> byArea, Map<String, TermEntry> entries,
                                    NativeLanguage nativeLanguage) {
        return new RegionDto(region.id(), region.name(), region.areas().stream()
                .map(a -> area(a, byArea.getOrDefault(a.id(), List.of()), entries, nativeLanguage)).toList());
    }

    private static AreaDto area(Area area, List<MapWord> words, Map<String, TermEntry> entries,
                                NativeLanguage nativeLanguage) {
        return new AreaDto(area.id(), area.name(), words.stream()
                .sorted(Comparator.comparingInt(w -> VocabMapCatalog.BANDS.indexOf(w.band())))
                .map(w -> word(w, entries, nativeLanguage)).toList());
    }

    private static WordDto word(MapWord word, Map<String, TermEntry> entries, NativeLanguage nativeLanguage) {
        WordStatus best = null;
        String own = null;
        for (String form : word.forms()) {
            TermEntry e = entries.get(form);
            if (e != null) {
                best = better(best, e.status());
                own = own == null && e.meaning() != null && !e.meaning().isBlank() ? e.meaning() : own;
            }
        }
        return new WordDto(word.headword(), word.band(), best, own != null ? own : word.meanings().get(nativeLanguage));
    }

    private static WordStatus better(WordStatus a, WordStatus b) {
        return a == null || rank(b) > rank(a) ? b : a;
    }

    private static int rank(WordStatus status) {
        return switch (status) {
            case KNOWN -> 3;
            case LEARNING -> 2;
            case IGNORED -> 1;
        };
    }
}
