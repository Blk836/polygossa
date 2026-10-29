package app.lector.dictionary;

import app.lector.token.Language;
import app.lector.token.NativeLanguage;
import app.lector.translation.InContext;
import app.lector.translation.LookupCounters;
import app.lector.translation.LookupLayer;
import app.lector.translation.LookupTally;
import app.lector.vocab.CommunityMeanings;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class OwnLanguageMeanings {

    private final CommunityMeanings community;
    private final SentenceMeanings sentences;
    private final LookupCounters counters;

    public OwnLanguageMeanings(CommunityMeanings community, SentenceMeanings sentences, LookupCounters counters) {
        this.community = community;
        this.sentences = sentences;
        this.counters = counters;
    }

    public WordLookup lookup(Long userId, Language language, NativeLanguage nativeLanguage, String key, String surface,
                             Optional<InContext> context, boolean bare) {
        if (nativeLanguage.code().equals(language.code())) {
            return new WordLookup(key, language.code(), List.of(), null, null);
        }
        LookupTally tally = new LookupTally();
        WordLookup found = bare
                ? bareWord(language, nativeLanguage, key, tally)
                : inReader(language, nativeLanguage, key, context.orElseGet(() -> InContext.alone(surface)), tally);
        counters.count(language, nativeLanguage, layer(found, tally), tally);
        return community.mine(userId, language, key, nativeLanguage).map(mine -> leadingWith(found, mine)).orElse(found);
    }

    private WordLookup inReader(Language language, NativeLanguage nativeLanguage, String key, InContext context,
                                LookupTally tally) {
        List<String> shared = community.top(language, key, nativeLanguage);
        Optional<SentenceMeanings.Found> inSentence = sentences.meaning(language, nativeLanguage, key, context, tally);
        if (inSentence.isPresent()) {
            return new WordLookup(key, language.code(), firstThen(inSentence.get().meaning(), shared),
                    nativeLanguage.code(), WordLookup.SENTENCE, inSentence.get().wordType());
        }
        return fromOthers(language, nativeLanguage, key, shared);
    }

    private static WordLookup fromOthers(Language language, NativeLanguage nativeLanguage, String key,
                                         List<String> shared) {
        if (shared.isEmpty()) {
            return new WordLookup(key, language.code(), List.of(), nativeLanguage.code(), null);
        }
        return new WordLookup(key, language.code(), shared, nativeLanguage.code(), WordLookup.COMMUNITY);
    }

    private WordLookup bareWord(Language language, NativeLanguage nativeLanguage, String key, LookupTally tally) {
        List<String> shared = community.top(language, key, nativeLanguage);
        if (!shared.isEmpty()) {
            return fromOthers(language, nativeLanguage, key, shared);
        }
        return sentences.alone(language, nativeLanguage, key, tally)
                .map(f -> new WordLookup(key, language.code(), List.of(f.meaning()), nativeLanguage.code(),
                        WordLookup.SENTENCE))
                .orElseGet(() -> fromOthers(language, nativeLanguage, key, List.of()));
    }

    private static LookupLayer layer(WordLookup found, LookupTally tally) {
        if (found.source() == null) {
            return LookupLayer.NONE;
        }
        if (WordLookup.COMMUNITY.equals(found.source())) {
            return LookupLayer.COMMUNITY;
        }
        return tally.aiCalls() > 0 ? LookupLayer.AI_NEW : LookupLayer.AI_STORED;
    }

    private static WordLookup leadingWith(WordLookup found, String mine) {
        return new WordLookup(found.term(), found.language(), firstThen(mine, found.meanings()),
                found.meaningLanguage(), found.source(), found.wordType());
    }

    private static List<String> firstThen(String first, List<String> others) {
        List<String> all = new ArrayList<>(List.of(first));
        others.stream().filter(o -> !o.equalsIgnoreCase(first)).forEach(all::add);
        return all;
    }
}
