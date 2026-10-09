package app.lector.vocabmap;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.token.TokenizationService;
import app.lector.vocabmap.VocabMapCatalog.MapWord;
import app.lector.vocabmap.VocabMapCatalog.WordList;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Reads one language's word list files: cells separated by {@code |}, a header line
 * {@code word | band | area | meaning:en | forms} (one meaning column per native language covered; forms are
 * separated by spaces), then one word per line. Blank lines and lines starting with
 * {@code #} are skipped. A meaning of {@code =} means the word is spelled the same in that language. A line with a
 * mistake is left out of the list and reported.
 */
final class WordListParser {

    /** One word as the reader splits text: letters, hyphen-joined parts, or an elided form ending in an apostrophe. */
    private static final Pattern ONE_WORD = Pattern.compile("[\\p{L}\\p{M}]+(?:-[\\p{L}\\p{M}]+)*'?");

    private static final String MEANING = "meaning:";

    private final Language language;
    private final Set<String> areas;
    private final List<String> problems = new ArrayList<>();
    private final List<MapWord> words = new ArrayList<>();
    /** Every form (headwords included) already taken, and the headword it belongs to. */
    private final Map<String, String> owners = new HashMap<>();
    private final Set<String> headwords = new LinkedHashSet<>();
    private List<NativeLanguage> meaningLanguages;

    WordListParser(Language language, Set<String> areas) {
        this.language = language;
        this.areas = areas;
    }

    void parse(String name, String content) {
        String[] lines = content.split("\\R", -1);
        List<NativeLanguage> columns = header(name, lines[0]);
        if (columns == null) {
            return;
        }
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i];
            if (!line.isBlank() && !line.startsWith("#")) {
                line(name + ":" + (i + 1), cells(line), columns);
            }
        }
    }

    private static String[] cells(String line) {
        String[] cells = line.split("\\|", -1);
        for (int i = 0; i < cells.length; i++) {
            cells[i] = cells[i].strip();
        }
        return cells;
    }

    /** The meaning languages a header names, or null (reported) when the header is wrong. */
    private List<NativeLanguage> header(String name, String line) {
        List<NativeLanguage> columns = meaningColumns(cells(line));
        if (columns == null || meaningLanguages != null && !meaningLanguages.equals(columns)) {
            problems.add(name + ":1: the header must be word, band, area, the same meaning columns in every file,"
                    + " then forms");
            return null;
        }
        meaningLanguages = columns;
        return columns;
    }

    /** The languages of a header's meaning columns, or null when it isn't word, band, area, meaning:xx..., forms. */
    private static List<NativeLanguage> meaningColumns(String[] cells) {
        boolean shape = cells.length >= 4 && cells[0].equals("word") && cells[1].equals("band")
                && cells[2].equals("area") && cells[cells.length - 1].equals("forms");
        if (!shape) {
            return null;
        }
        List<NativeLanguage> columns = new ArrayList<>();
        for (int i = 3; i < cells.length - 1; i++) {
            if (!cells[i].startsWith(MEANING)) {
                return null;
            }
            columns.add(NativeLanguage.fromCode(cells[i].substring(MEANING.length())));
        }
        return columns;
    }

    private void line(String where, String[] cells, List<NativeLanguage> columns) {
        int expected = columns.size() + 4;
        if (cells.length != expected) {
            problems.add(where + ": expected " + expected + " columns, found " + cells.length);
            return;
        }
        String headword = normalize(cells[0]);
        int before = problems.size();
        if (!headwords.add(headword)) {
            problems.add(where + ": \"" + headword + "\" appears twice");
            return;
        }
        checkFields(where, headword, cells[1].strip(), cells[2].strip());
        Map<NativeLanguage, String> meanings = meanings(where, headword, cells, columns);
        Set<String> forms = forms(where, headword, cells[cells.length - 1]);
        if (problems.size() == before) {
            forms.forEach(f -> owners.put(f, headword));
            words.add(new MapWord(headword, cells[1].strip(), cells[2].strip(), meanings, forms));
        }
    }

    private void checkFields(String where, String headword, String band, String area) {
        if (!ONE_WORD.matcher(headword).matches()) {
            problems.add(where + ": \"" + headword + "\" is not one word");
        }
        if (!VocabMapCatalog.BANDS.contains(band)) {
            problems.add(where + ": unknown band \"" + band + "\"");
        }
        if (!areas.contains(area)) {
            problems.add(where + ": unknown area \"" + area + "\"");
        }
    }

    private Map<NativeLanguage, String> meanings(String where, String headword, String[] cells,
                                                 List<NativeLanguage> columns) {
        Map<NativeLanguage, String> meanings = new EnumMap<>(NativeLanguage.class);
        for (int i = 0; i < columns.size(); i++) {
            String meaning = cells[3 + i].strip();
            String code = columns.get(i).name().toLowerCase(java.util.Locale.ROOT);
            if (meaning.isEmpty()) {
                problems.add(where + ": \"" + headword + "\" has no " + code + " meaning");
            } else if (meaning.equals("=")) {
                meanings.put(columns.get(i), cells[0].strip());
            } else if (normalize(meaning).equals(headword)) {
                problems.add(where + ": the " + code + " meaning copies the word; write = if it is really the same");
            } else {
                meanings.put(columns.get(i), meaning);
            }
        }
        return meanings;
    }

    private Set<String> forms(String where, String headword, String cell) {
        Set<String> forms = new LinkedHashSet<>();
        forms.add(headword);
        for (String raw : cell.strip().split("\\s+")) {
            if (!raw.isEmpty()) {
                forms.add(normalize(raw));
            }
        }
        for (String form : forms) {
            String owner = owners.get(form);
            if (!ONE_WORD.matcher(form).matches()) {
                problems.add(where + ": \"" + form + "\" is not one word");
            } else if (owner != null) {
                problems.add(where + ": \"" + form + "\" already belongs to \"" + owner + "\"");
            }
        }
        return forms;
    }

    private String normalize(String term) {
        return TokenizationService.normalize(term, language);
    }

    WordList result() {
        return new WordList(language, meaningLanguages == null ? List.of() : meaningLanguages, List.copyOf(words));
    }

    List<String> problems() {
        return problems;
    }
}
