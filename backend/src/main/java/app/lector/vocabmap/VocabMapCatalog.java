package app.lector.vocabmap;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * The vocabulary map's data: one blueprint of regions and areas shared by every language, and each language's word
 * list filling it (vocabulary-map.feature). Both are files on the classpath, so a new language is a new folder of
 * lists and no code. Mistakes in a list are collected in {@link #problems()}, which a test keeps empty.
 */
@Component
public class VocabMapCatalog {

    static final String BLUEPRINT = "classpath:vocabmap/blueprint.json";
    static final String LISTS = "classpath*:vocabmap/lists/*/*.words";

    /** The CEFR bands a word can belong to, lowest first; each includes the ones before it. */
    public static final List<String> BANDS = List.of("A1", "A2", "B1", "B2", "C1");

    public record Area(String id, String name) {}

    public record Region(String id, String name, List<Area> areas) {}

    public record Blueprint(List<Region> regions) {
        Set<String> areaIds() {
            return regions.stream().flatMap(r -> r.areas().stream()).map(Area::id).collect(Collectors.toSet());
        }
    }

    /** A word on the map: its forms are normalised like vocabulary terms and include the headword. */
    public record MapWord(String headword, String band, String area, Map<NativeLanguage, String> meanings,
                          Set<String> forms) {}

    public record WordList(Language language, List<NativeLanguage> meaningLanguages, List<MapWord> words) {

        /** The bands this list has, from A1 up to the first one with no words. */
        public List<String> bands() {
            Set<String> present = words.stream().map(MapWord::band).collect(Collectors.toSet());
            List<String> bands = new ArrayList<>();
            for (String band : BANDS) {
                if (!present.contains(band)) {
                    break;
                }
                bands.add(band);
            }
            return bands;
        }

        /** How many words the list has up to and including this band. */
        public int cumulative(String band) {
            int top = BANDS.indexOf(band);
            return (int) words.stream().filter(w -> BANDS.indexOf(w.band()) <= top).count();
        }

        /** The blueprint's areas that have no word up to this band. */
        public List<String> emptyAreas(Blueprint blueprint, String upTo) {
            int top = BANDS.indexOf(upTo);
            Set<String> filled = words.stream().filter(w -> BANDS.indexOf(w.band()) <= top).map(MapWord::area)
                    .collect(Collectors.toSet());
            return blueprint.regions().stream().flatMap(r -> r.areas().stream()).map(Area::id)
                    .filter(id -> !filled.contains(id)).toList();
        }
    }

    private final Blueprint blueprint;
    private final Map<Language, WordList> lists = new EnumMap<>(Language.class);
    private final List<String> problems = new ArrayList<>();

    public VocabMapCatalog() {
        this(BLUEPRINT, LISTS);
    }

    VocabMapCatalog(String blueprintLocation, String listsPattern) {
        var resolver = new PathMatchingResourcePatternResolver();
        try (InputStream in = resolver.getResource(blueprintLocation).getInputStream()) {
            blueprint = JsonMapper.builder().build().readValue(in, Blueprint.class);
            Map<Language, List<Resource>> files = byLanguage(resolver.getResources(listsPattern));
            for (var entry : files.entrySet()) {
                WordListParser parser = new WordListParser(entry.getKey(), blueprint.areaIds());
                for (Resource file : entry.getValue()) {
                    parser.parse(entry.getKey().code() + "/" + file.getFilename(),
                            new String(file.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
                }
                lists.put(entry.getKey(), parser.result());
                problems.addAll(parser.problems());
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Groups list files by the language folder they are in ("…/lists/fr/food.words" is French), in name order. */
    private Map<Language, List<Resource>> byLanguage(Resource[] resources) {
        Map<Language, List<Resource>> files = new EnumMap<>(Language.class);
        Arrays.stream(resources).sorted(Comparator.comparing(Resource::getFilename)).forEach(r -> {
            String[] parts = url(r).split("/");
            String folder = parts[parts.length - 2];
            try {
                files.computeIfAbsent(Language.fromCode(folder), l -> new ArrayList<>()).add(r);
            } catch (IllegalArgumentException e) {
                problems.add(folder + "/" + r.getFilename() + ": \"" + folder + "\" is not a language");
            }
        });
        return files;
    }

    private static String url(Resource resource) {
        try {
            return resource.getURL().toString();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public Blueprint blueprint() {
        return blueprint;
    }

    public Optional<WordList> list(Language language) {
        return Optional.ofNullable(lists.get(language));
    }

    /** Every mistake found in the lists, as "fr/food.words:12: what is wrong". */
    public List<String> problems() {
        return List.copyOf(problems);
    }
}
