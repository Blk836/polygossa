package app.lector.progress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.user.User;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class CountingNeverBreaksReadingTest {

    @Test
    void aFailedFillOfWordOrPhraseCountsStillSavesTheReadingPosition() {
        ReadingProgressRepository repo = mock(ReadingProgressRepository.class);
        WordsReadRepository wordsRead = mock(WordsReadRepository.class);
        TextService texts = mock(TextService.class);
        WordCounts words = mock(WordCounts.class);
        PhraseCounts phrases = mock(PhraseCounts.class);
        User user = mock(User.class);
        Text text = mock(Text.class);
        when(user.getId()).thenReturn(7L);
        when(user.zone()).thenReturn(ZoneOffset.UTC);
        when(text.getId()).thenReturn(3L);
        when(text.getLanguage()).thenReturn(Language.FR);
        when(texts.loadReadable(user, 3L)).thenReturn(text);
        when(texts.tokens(text)).thenReturn(List.of(new Token(0, "un", true, "un", null, null, 0),
                new Token(1, " ", false, null, null, null, 0), new Token(2, "deux", true, "deux", null, null, 0)));
        when(repo.findOne(anyLong(), anyLong())).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(a -> a.getArgument(0));
        doThrow(new DataIntegrityViolationException("phrase deleted meanwhile")).when(phrases).fill(7L);
        doThrow(new DataIntegrityViolationException("text deleted meanwhile")).when(words).fill(7L);
        doThrow(new DataIntegrityViolationException("lock timeout")).when(phrases)
                .add(anyLong(), any(), any(), anyInt(), anyInt());
        ProgressService service = new ProgressService(repo, wordsRead, texts, words, phrases,
                Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneOffset.UTC));

        assertThat(service.record(user, 3L, 2).position()).isEqualTo(2);
        service.complete(user, 3L);
    }
}
