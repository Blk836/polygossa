package app.lector.text;

import app.lector.token.Language;
import app.lector.token.Token;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class TextWords {

    public record WordsInTexts(Map<Long, Set<String>> byText, Set<String> names) {}

    private final TextRepository texts;
    private final PersonNames names;
    private final NotWords notWords;
    private final UniqueWordsCache uniqueWords;
    private final ObjectMapper json;

    public TextWords(TextRepository texts, PersonNames names, NotWords notWords, UniqueWordsCache uniqueWords,
                     ObjectMapper json) {
        this.texts = texts;
        this.names = names;
        this.notWords = notWords;
        this.uniqueWords = uniqueWords;
        this.json = json;
    }

    DifficultyEstimator.Estimate setTokens(Text text, List<Token> tokens) {
        Set<String> found = names.find(text.getLanguage(), tokens);
        text.setTokensJson(json.writeValueAsString(tokens));
        text.setWordsJson(KnownWords.wordsJson(tokens, json));
        text.setPersonNamesJson(names.toJson(found));
        return setNotWords(text, tokens, notWords.find(text.getLanguage(), tokens, found));
    }

    private DifficultyEstimator.Estimate setNotWords(Text text, List<Token> tokens, Set<String> found) {
        text.setNotWordsJson(notWords.toJson(found));
        DifficultyEstimator.Estimate estimate = DifficultyEstimator.estimate(text.getLanguage(), tokens,
                setAside(text));
        text.setWordCount(estimate.wordCount());
        text.setUniqueWordCount(estimate.uniqueWordCount());
        return estimate;
    }

    public Set<String> setAside(Text text) {
        Set<String> out = new HashSet<>(names.of(text));
        out.addAll(notWords.of(text));
        return out;
    }

    Set<String> words(Text text) {
        return text.getWordsJson() == null ? UniqueWordsCache.distinct(tokens(text))
                : uniqueWords.words(text.getId(), text.getWordsJson(), stored -> KnownWords.readWords(stored, json));
    }

    private List<Token> tokens(Text text) {
        return json.readValue(text.getTokensJson(), new TypeReference<List<Token>>() {});
    }

    @Transactional(readOnly = true)
    public WordsInTexts wordsInTexts(Language language) {
        Map<Long, Set<String>> byText = new HashMap<>();
        Set<String> allNames = new HashSet<>();
        for (Text text : texts.findByLanguage(language)) {
            byText.put(text.getId(), words(text));
            allNames.addAll(names.of(text));
        }
        return new WordsInTexts(byText, allNames);
    }

    @Transactional
    public int refreshNotWords(Language language, Set<String> allNotWords) {
        int updated = 0;
        for (Text text : texts.findByLanguage(language)) {
            Set<String> found = new LinkedHashSet<>(words(text));
            found.retainAll(allNotWords);
            found.removeAll(names.of(text));
            if (!found.equals(notWords.of(text))) {
                setNotWords(text, tokens(text), found);
                updated++;
            }
        }
        return updated;
    }
}
