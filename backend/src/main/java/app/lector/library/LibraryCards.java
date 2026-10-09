package app.lector.library;

import app.lector.progress.ProgressService;
import app.lector.text.Text;
import app.lector.text.TextDtos.TextSummary;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.vocab.WordStatus;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class LibraryCards {

    private final TextService textService;
    private final TextReactionRepository reactions;
    private final ProgressService progress;

    public LibraryCards(TextService textService, TextReactionRepository reactions, ProgressService progress) {
        this.textService = textService;
        this.reactions = reactions;
        this.progress = progress;
    }

    public List<TextSummary> summaries(User user, List<Text> page, Map<Language, Map<String, WordStatus>> statusCache) {
        if (page.isEmpty()) {
            return List.of();
        }
        Set<Long> ids = page.stream().map(Text::getId).collect(Collectors.toSet());
        Map<Long, Long> likes = reactions.likeCounts(ids).stream()
                .collect(Collectors.toMap(TextReactionRepository.TextCount::getTextId, TextReactionRepository.TextCount::getCount));
        Set<Long> liked = new HashSet<>();
        Set<Long> bookmarked = new HashSet<>();
        for (TextReaction r : reactions.findMine(user.getId(), ids)) {
            (r.getType() == TextReaction.Type.LIKE ? liked : bookmarked).add(r.getText().getId());
        }
        return progress.attach(user, page.stream()
                .map(t -> textService.summarize(user, t, textService.statsFor(user, t, statusCache),
                        likes.getOrDefault(t.getId(), 0L), liked.contains(t.getId()), bookmarked.contains(t.getId())))
                .toList());
    }
}
