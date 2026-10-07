package app.lector.dictionary;

import app.lector.config.AppProperties;
import app.lector.token.Language;
import java.io.Serializable;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.MissingNode;

/**
 * Free dictionary sources: the Free Dictionary API (freedictionaryapi.com, Wiktionary-derived, with IPA) first,
 * then the Wiktionary REST definition endpoint. Results are cached ("dictionary" cache — Redis in production).
 */
@Component
public class DictionaryClient {

    private static final Logger log = LoggerFactory.getLogger(DictionaryClient.class);
    private static final String USER_AGENT = "LectorReader/0.1 (language learning reader)";
    private static final int MAX_SENSES = 8;
    private static final Pattern FORM_OF = Pattern.compile(
            "^(?:(?:feminine |masculine )?(?:singular |plural )?(?:inflection|plural|feminine|masculine|singular"
                    + "|past participle|present participle|gerund|alternative form|diminutive|form)"
                    + "|(?:first|second|third)[- ]person .*?) of ([^\\s:;,()]+)",
            Pattern.CASE_INSENSITIVE);

    private final RestClient freeDictionary;
    private final RestClient wiktionary;

    public DictionaryClient(AppProperties props, RestClient.Builder builder) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.dictionary().timeout());
        factory.setReadTimeout(props.dictionary().timeout());
        this.freeDictionary = builder.clone()
                .baseUrl(props.dictionary().freeDictionaryBaseUrl())
                .defaultHeader("User-Agent", USER_AGENT)
                .requestFactory(factory)
                .build();
        this.wiktionary = builder.clone()
                .baseUrl(props.dictionary().wiktionaryBaseUrl())
                .defaultHeader("User-Agent", USER_AGENT)
                .requestFactory(factory)
                .build();
    }

    @Cacheable(cacheNames = "dictionary", key = "#language.code() + ':' + #term")
    public DictionaryResult lookup(Language language, String term) {
        return fromFreeDictionary(language, term)
                .or(() -> fromWiktionary(language, term))
                .orElseGet(() -> DictionaryResult.notFound(term, language.code()));
    }

    /** One English word's translation tables, as lists of (language, word) per sense. Cached like lookups. */
    public record Translation(String language, String word) implements Serializable {}

    /**
     * The translation tables of an English word's senses, in order (only senses that have one). Empty when the word
     * has no entry or the source fails.
     */
    @Cacheable(cacheNames = "dictionary", key = "'en-translations:' + #word")
    public ArrayList<ArrayList<Translation>> translationTables(String word) {
        JsonNode body = fetch(freeDictionary, "Free Dictionary API", Language.EN, word,
                "/entries/en/{word}?translations=true", word);
        ArrayList<ArrayList<Translation>> tables = new ArrayList<>();
        for (JsonNode entry : body.path("entries")) {
            for (JsonNode sense : entry.path("senses")) {
                ArrayList<Translation> table = new ArrayList<>();
                for (JsonNode t : sense.path("translations")) {
                    table.add(new Translation(t.path("language").path("code").asString(""), t.path("word").asString("")));
                }
                if (!table.isEmpty()) {
                    tables.add(table);
                }
            }
        }
        return tables;
    }

    Optional<DictionaryResult> fromFreeDictionary(Language language, String term) {
        JsonNode body = fetch(freeDictionary, "Free Dictionary API", language, term, "/entries/{lang}/{word}",
                language.code(), term);
        Senses senses = new Senses(term);
        String pronunciation = null;
        for (JsonNode entry : body.path("entries")) {
            if (!language.code().equals(entry.path("language").path("code").asString(""))) {
                continue;
            }
            if (pronunciation == null) {
                pronunciation = preferredPronunciation(entry.path("pronunciations"));
            }
            String pos = entry.path("partOfSpeech").asString("");
            for (JsonNode sense : entry.path("senses")) {
                senses.add(pos, withFirstSubsense(sense), texts(sense.path("examples"), false));
            }
        }
        return senses.toResult(language, pronunciation, "Free Dictionary API (Wiktionary)");
    }

    Optional<DictionaryResult> fromWiktionary(Language language, String term) {
        JsonNode body = fetch(wiktionary, "Wiktionary", language, term, "/page/definition/{term}", term);
        Senses senses = new Senses(term);
        for (JsonNode usage : body.path(language.code())) {
            String pos = usage.path("partOfSpeech").asString("").toLowerCase();
            for (JsonNode def : usage.path("definitions")) {
                senses.add(pos, html(def.path("definition").asString("")).strip(), texts(def.path("examples"), true));
            }
        }
        return senses.toResult(language, null, "Wiktionary");
    }

    /** GETs JSON, treating any HTTP or connection error as "no entry" (an empty node). */
    private static JsonNode fetch(RestClient client, String source, Language language, String term, String uri,
                                  Object... vars) {
        try {
            JsonNode body = client.get().uri(uri, vars).retrieve().body(JsonNode.class);
            return body == null ? MissingNode.getInstance() : body;
        } catch (RestClientException e) {
            log.debug("{} miss for {}:{} — {}", source, language.code(), term, e.getMessage());
            return MissingNode.getInstance();
        }
    }

    /** The first IPA transcription, else the first pronunciation of any kind. */
    static String preferredPronunciation(JsonNode pronunciations) {
        String first = null;
        for (JsonNode p : pronunciations) {
            String text = p.path("text").asString(null);
            if ("ipa".equals(p.path("type").asString(""))) {
                return text;
            }
            if (first == null) {
                first = text;
            }
        }
        return first;
    }

    /** "inflection of casar:" reads badly alone, so append the first sub-sense. */
    private static String withFirstSubsense(JsonNode sense) {
        String definition = sense.path("definition").asString("").strip();
        JsonNode subsenses = sense.path("subsenses");
        if (definition.endsWith(":") && !subsenses.isEmpty()) {
            return definition + " " + subsenses.get(0).path("definition").asString("");
        }
        return definition;
    }

    private static List<String> texts(JsonNode array, boolean stripHtml) {
        List<String> out = new ArrayList<>();
        for (JsonNode node : array) {
            out.add(stripHtml ? html(node.asString("")) : node.asString(""));
        }
        return out;
    }

    private static String html(String fragment) {
        return Jsoup.parse(fragment).text();
    }

    /** Collects up to {@link #MAX_SENSES} non-blank senses and the first lemma found among them. */
    private static final class Senses {
        private final String term;
        private final List<DictionaryResult.Sense> list = new ArrayList<>();
        private String lemma;

        Senses(String term) {
            this.term = term;
        }

        void add(String pos, String definition, List<String> examples) {
            if (lemma == null) {
                lemma = lemmaFrom(definition, term);
            }
            if (!definition.isBlank() && list.size() < MAX_SENSES) {
                list.add(new DictionaryResult.Sense(pos, definition, examples.stream().limit(2).toList()));
            }
        }

        Optional<DictionaryResult> toResult(Language language, String pronunciation, String source) {
            if (list.isEmpty()) {
                return Optional.empty();
            }
            String url = "https://en.wiktionary.org/wiki/"
                    + URLEncoder.encode(term, StandardCharsets.UTF_8).replace("+", "_");
            return Optional.of(new DictionaryResult(term, language.code(), true, pronunciation, list, lemma, source, url));
        }
    }

    /** Extracts the base word from definitions like "inflection of casar:" or "plural of perro". */
    static String lemmaFrom(String definition, String term) {
        Matcher m = FORM_OF.matcher(definition);
        if (m.find()) {
            String lemma = m.group(1).replaceAll("[.:]$", "");
            return lemma.equalsIgnoreCase(term) ? null : lemma;
        }
        return null;
    }

}
