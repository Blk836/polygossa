package app.lector.token;

import app.lector.config.AppProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class TokenizationService {

    private static final Logger log = LoggerFactory.getLogger(TokenizationService.class);

    private static final Pattern SENTENCE_END = Pattern.compile("[.!?…。！？]|\\n");

    private final RestClient sidecar;

    public TokenizationService(AppProperties props, RestClient.Builder builder) {
        String url = props.tokenizer().url();
        if (url == null || url.isBlank()) {
            this.sidecar = null;
        } else {
            var factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(props.tokenizer().timeout());
            factory.setReadTimeout(props.tokenizer().timeout());
            this.sidecar = builder.clone().baseUrl(url).requestFactory(factory).build();
        }
    }

    public List<Token> tokenize(Language language, String text) {
        String clean = text.replace("\r\n", "\n").replace('\r', '\n');
        List<RawToken> raw = language.spaceDelimited()
                ? SpaceDelimitedTokenizer.tokenize(language, clean)
                : tokenizeCjk(language, clean);
        return Annotations.unmark(finish(language, raw));
    }

    static List<Token> finish(Language language, List<RawToken> raw) {
        Locale locale = Locale.forLanguageTag(language.code());
        List<Token> out = new ArrayList<>(raw.size());
        int sentence = 0;
        boolean sentenceHasWords = false;
        for (RawToken t : raw) {
            if (t.word()) {
                String key = t.lemma() != null && !t.lemma().isBlank() ? t.lemma() : t.text();
                out.add(new Token(out.size(), t.text(), true, normalize(key, locale), t.lemma(), t.reading(), sentence));
                sentenceHasWords = true;
            } else {
                out.add(new Token(out.size(), t.text(), false, null, null, null, sentence));
                if (sentenceHasWords && SENTENCE_END.matcher(t.text()).find()) {
                    sentence++;
                    sentenceHasWords = false;
                }
            }
        }
        return out;
    }

    public static String normalize(String term, Language language) {
        return normalize(term, Locale.forLanguageTag(language.code()));
    }

    private static String normalize(String term, Locale locale) {
        return term.strip().replace('’', '\'').toLowerCase(locale);
    }

    private List<RawToken> tokenizeCjk(Language language, String text) {
        if (sidecar != null) {
            try {
                SidecarResponse response = sidecar.post()
                        .uri("/tokenize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(new SidecarRequest(language.code(), text))
                        .retrieve()
                        .body(SidecarResponse.class);
                if (response != null && response.tokens() != null) {
                    return response.tokens().stream()
                            .map(t -> new RawToken(t.surface(), t.isWord(), t.lemma(), t.reading()))
                            .toList();
                }
            } catch (RestClientException e) {
                log.warn("Tokenizer sidecar unavailable, using fallback segmentation: {}", e.getMessage());
            }
        }
        if (language == Language.KO) {
            return SpaceDelimitedTokenizer.tokenize(language, text);
        }
        return FallbackCjkTokenizer.tokenize(language, text);
    }

    record SidecarRequest(String language, String text) {}

    record SidecarToken(
            String surface,
            @JsonProperty("is_word") boolean isWord,
            String lemma,
            String reading,
            String pos) {}

    record SidecarResponse(List<SidecarToken> tokens) {}
}
