package app.lector.anki;

import app.lector.common.ApiException;
import app.lector.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnkiSyncService {

    public static final int MAX_BATCH = 1000;

    public record CardRequest(@Size(max = 10_000) String word, @NotNull @Min(0) @Max(3) Integer type,
                              @NotNull Integer interval, @Size(max = 20_000) String meaning) {}

    public record CardsRequest(@NotNull Long ankiDeckId,
                               @NotNull @Size(max = MAX_BATCH) List<@Valid @NotNull CardRequest> cards) {}

    public record StartRequest(boolean dryRun) {}

    public record FinishRequest(@NotNull List<@NotNull Long> ankiDeckIds) {}

    public record WordsDto(List<String> words) {}

    public record RunDto(long id, boolean dryRun, String state, Instant startedAt, Instant finishedAt, int cards,
                         int becameKnown, int addedKnown, int addedLearning, int overLimit, int skippedEmpty,
                         int skippedTooLong, int skippedMedia, int leaveReview) {
        static RunDto of(AnkiSyncRun r) {
            return new RunDto(r.getId(), r.isDryRun(), r.getState().name().toLowerCase(Locale.ROOT), r.getStartedAt(),
                    r.getFinishedAt(), r.getCards(), r.getBecameKnown(), r.getAddedKnown(), r.getAddedLearning(),
                    r.getOverLimit(), r.getSkippedEmpty(), r.getSkippedTooLong(), r.getSkippedMedia(),
                    r.getLeaveReview());
        }
    }

    private final AnkiDeckRepository decks;
    private final AnkiLinkRepository links;
    private final AnkiSyncRunRepository runs;
    private final AnkiMerge merge;
    private final Clock clock;

    public AnkiSyncService(AnkiDeckRepository decks, AnkiLinkRepository links, AnkiSyncRunRepository runs,
                           AnkiMerge merge, Clock clock) {
        this.decks = decks;
        this.links = links;
        this.runs = runs;
        this.merge = merge;
        this.clock = clock;
    }

    @Transactional
    public RunDto start(User user, boolean dryRun) {
        if (decks.findByUserIdOrderById(user.getId()).isEmpty()) {
            throw ApiException.badRequest("Choose an Anki deck first");
        }
        Instant now = clock.instant();
        for (AnkiSyncRun running : runs.findByUserIdAndState(user.getId(), AnkiSyncRun.State.RUNNING)) {
            if (!running.stopIfQuiet(now)) {
                throw ApiException.conflict("A sync with Anki is already running");
            }
        }
        runs.flush();
        Long keep = runs.findFirstByUserIdAndDryRunFalseOrderByIdDesc(user.getId()).map(AnkiSyncRun::getId)
                .orElse(null);
        runs.deleteAllBut(user.getId(), keep);
        return RunDto.of(runs.save(new AnkiSyncRun(user.getId(), dryRun, now)));
    }

    @Transactional
    public RunDto cards(User user, long runId, CardsRequest req) {
        AnkiSyncRun run = running(user, runId);
        AnkiDeck deck = decks.findByUserIdAndAnkiDeckId(user.getId(), req.ankiDeckId())
                .orElseThrow(() -> ApiException.badRequest("That deck isn't one of your chosen Anki decks"));
        merge.apply(user, run, deck, req.cards());
        run.active(clock.instant());
        return RunDto.of(run);
    }

    @Transactional
    public RunDto finish(User user, long runId, List<Long> ankiDeckIds) {
        AnkiSyncRun run = running(user, runId);
        Instant now = clock.instant();
        if (!run.isDryRun()) {
            for (Long id : ankiDeckIds) {
                decks.findByUserIdAndAnkiDeckId(user.getId(), id).ifPresent(deck -> {
                    links.deleteNotSeenIn(deck.getId(), run.getId());
                    deck.synced(now);
                });
            }
        }
        run.finish(now);
        return RunDto.of(run);
    }

    @Transactional
    public RunDto stop(User user, long runId) {
        AnkiSyncRun run = running(user, runId);
        run.stop(clock.instant());
        return RunDto.of(run);
    }

    @Transactional
    public Optional<RunDto> latest(User user) {
        return runs.findFirstByUserIdAndDryRunFalseOrderByIdDesc(user.getId()).map(run -> {
            run.stopIfQuiet(clock.instant());
            return RunDto.of(run);
        });
    }

    @Transactional(readOnly = true)
    public WordsDto words(User user, long runId, String outcome) {
        AnkiOutcome parsed = AnkiOutcome.parse(outcome);
        AnkiSyncRun run = runs.findByIdAndUserId(runId, user.getId())
                .orElseThrow(() -> ApiException.notFound("Sync"));
        return new WordsDto(runs.findTerms(run.getId(), parsed));
    }

    private AnkiSyncRun running(User user, long runId) {
        AnkiSyncRun run = runs.findByIdAndUserId(runId, user.getId()).orElseThrow(() -> ApiException.notFound("Sync"));
        run.stopIfQuiet(clock.instant());
        if (run.getState() != AnkiSyncRun.State.RUNNING) {
            throw ApiException.conflict("This sync with Anki has ended");
        }
        return run;
    }
}
