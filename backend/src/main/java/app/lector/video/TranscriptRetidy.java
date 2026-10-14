package app.lector.video;

import app.lector.common.ApiException;
import app.lector.progress.ReadingProgress;
import app.lector.progress.ReadingProgressRepository;
import app.lector.text.SubtitleParser.Cue;
import app.lector.text.Text;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.token.Token;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
public class TranscriptRetidy {

    public record Report(long textId, String title, long ownerId, int lines, int tidiedLines) {}

    private record Source(Language language, List<Cue> cues) {}

    private final TextService texts;
    private final TranscriptTidy tidy;
    private final ReadingProgressRepository progress;
    private final ObjectMapper json;
    private final TransactionTemplate tx;

    public TranscriptRetidy(TextService texts, TranscriptTidy tidy, ReadingProgressRepository progress,
                            ObjectMapper json, PlatformTransactionManager transactions) {
        this.texts = texts;
        this.tidy = tidy;
        this.progress = progress;
        this.json = json;
        this.tx = new TransactionTemplate(transactions);
    }

    public Report retidy(Long id) {
        Source source = tx.execute(status -> {
            Text text = texts.load(id);
            List<Cue> cues = texts.cues(text);
            if (!text.isVideo() || cues.isEmpty()) {
                throw ApiException.badRequest("This text has no video captions to tidy");
            }
            return new Source(text.getLanguage(), cues);
        });
        TranscriptTidy.Result result = tidy.tidyAutomatic(source.language(), source.cues());
        return tx.execute(status -> save(id, result));
    }

    private Report save(Long id, TranscriptTidy.Result result) {
        Text text = texts.load(id);
        List<Token> before = texts.tokens(text);
        List<Cue> cues = result.parsed().cues();
        List<Token> after = texts.replaceTranscript(text, result.parsed().content(), cues);
        text.setTimingsJson(json.writeValueAsString(
                VideoImportService.timings(after, cues, text.getVideoDurationSeconds())));
        for (ReadingProgress p : progress.findForText(id)) {
            p.setPosition(sameWord(p.getPosition(), before, after));
        }
        return new Report(id, text.getTitle(), text.getOwner().getId(), result.lines(), result.changedLines());
    }

    static int sameWord(int position, List<Token> before, List<Token> after) {
        int ordinal = 0;
        for (int i = 0; i < Math.min(position, before.size()); i++) {
            if (before.get(i).word()) {
                ordinal++;
            }
        }
        List<Integer> words = new ArrayList<>();
        for (Token t : after) {
            if (t.word()) {
                words.add(t.index());
            }
        }
        if (ordinal < words.size()) {
            return words.get(ordinal);
        }
        return Math.max(0, after.size() - 1);
    }
}
