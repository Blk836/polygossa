package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.token.Token;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

/** Feature: lists of cards count known words from each text's stored distinct words without re-reading them. */
class UniqueWordsCacheTest {

    private static final String HOLA = "hola amigos";
    private static final String ADIOS = "adios";

    /** "Reads" a stored word list (space-separated here), recording each call. */
    private final List<String> read = new ArrayList<>();
    private final Function<String, Set<String>> reader = stored -> {
        read.add(stored);
        return new LinkedHashSet<>(List.of(stored.split(" ")));
    };

    @Test
    void distinctKeepsEachNormalisedWordOnceAndLeavesOutNonWords() {
        List<Token> tokens = List.of(
                new Token(0, "Hola", true, "hola", null, null, 0),
                new Token(1, ", ", false, null, null, null, 0),
                new Token(2, "amigos", true, "amigos", null, null, 0),
                new Token(3, " ", false, null, null, null, 0),
                new Token(4, "hola", true, "hola", null, null, 0));
        assertThat(UniqueWordsCache.distinct(tokens)).containsExactly("hola", "amigos");
    }

    @Test
    void givesTheStoredWords() {
        UniqueWordsCache cache = new UniqueWordsCache(10);
        assertThat(cache.words(1L, HOLA, reader)).containsExactly("hola", "amigos");
    }

    @Test
    void readsATextOnlyOnceWhileItsWordsStayTheSame() {
        UniqueWordsCache cache = new UniqueWordsCache(10);
        cache.words(1L, HOLA, reader);
        assertThat(cache.words(1L, new String(HOLA), reader)).containsExactly("hola", "amigos");
        assertThat(read).hasSize(1);
    }

    @Test
    void rereadsATextWhoseWordsChanged() {
        UniqueWordsCache cache = new UniqueWordsCache(10);
        cache.words(1L, HOLA, reader);
        assertThat(cache.words(1L, ADIOS, reader)).containsExactly("adios");
        assertThat(read).containsExactly(HOLA, ADIOS);
    }

    @Test
    void keepsTextsApart() {
        UniqueWordsCache cache = new UniqueWordsCache(10);
        cache.words(1L, HOLA, reader);
        assertThat(cache.words(2L, ADIOS, reader)).containsExactly("adios");
        assertThat(cache.words(1L, HOLA, reader)).containsExactly("hola", "amigos");
        assertThat(read).containsExactly(HOLA, ADIOS);
    }

    @Test
    void anUnsavedTextIsReadEveryTime() {
        UniqueWordsCache cache = new UniqueWordsCache(10);
        cache.words(null, HOLA, reader);
        assertThat(cache.words(null, HOLA, reader)).containsExactly("hola", "amigos");
        assertThat(read).hasSize(2);
    }

    @Test
    void forgetsTheLeastRecentlyUsedTextWhenFull() {
        UniqueWordsCache cache = new UniqueWordsCache(2);
        cache.words(1L, HOLA, reader);
        cache.words(2L, ADIOS, reader);
        cache.words(1L, HOLA, reader); // 1 is now the most recently used
        cache.words(3L, ADIOS, reader); // evicts 2
        read.clear();
        cache.words(1L, HOLA, reader);
        assertThat(read).isEmpty();
        cache.words(2L, ADIOS, reader);
        assertThat(read).containsExactly(ADIOS);
    }
}
