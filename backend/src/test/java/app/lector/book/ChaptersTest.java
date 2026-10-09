package app.lector.book;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class ChaptersTest {

    @Test
    void aChapterThatFitsKeepsItsTitle() {
        assertThat(Chapters.split("Uno", "a\n\nb", 100)).containsExactly(new Book.Chapter("Uno", "a\n\nb"));
    }

    @Test
    void paragraphsArePackedUpToTheLimitInclusive() {
        assertThat(Chapters.pack("aaaa\n\nbbbb", 10)).containsExactly("aaaa\n\nbbbb");
        assertThat(Chapters.pack("aaaa\n\nbbbb", 9)).containsExactly("aaaa", "bbbb");
        assertThat(Chapters.split("T", "aaaa\n\nbbbb", 9)).extracting(Book.Chapter::title).containsExactly("T (1)", "T (2)");
    }

    @Test
    void aParagraphTooLongIsCutAtLineBreaks() {
        assertThat(Chapters.pack("one two\nthree four\nfive", 12)).containsExactly("one two", "three four", "five");
        assertThat(Chapters.pack("one two\nthree four\nfive", 16)).containsExactly("one two", "three four\nfive");
    }

    @Test
    void aLineTooLongIsCutAtSpaces() {
        List<String> parts = Chapters.pack("alpha beta gamma delta", 11);
        assertThat(parts).containsExactly("alpha beta", "gamma delta");
    }

    @Test
    void aWordTooLongIsCutAtTheLimit() {
        assertThat(Chapters.pack("abcdefghij", 4)).containsExactly("abcd", "efgh", "ij");
    }

    @Test
    void aTextExactlyAtTheLimitIsNotCut() {
        assertThat(Chapters.pack("abcd", 4)).containsExactly("abcd");
    }
}
