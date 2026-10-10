package app.lector.anki;

import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/anki")
public class AnkiController {

    private final AnkiDeckService deckService;
    private final AnkiSyncService syncService;
    private final CurrentUser currentUser;

    public AnkiController(AnkiDeckService deckService, AnkiSyncService syncService, CurrentUser currentUser) {
        this.deckService = deckService;
        this.syncService = syncService;
        this.currentUser = currentUser;
    }

    @GetMapping("/decks")
    public AnkiDeckService.DecksDto decks(@AuthenticationPrincipal AuthUser principal) {
        return deckService.list(currentUser.load(principal));
    }

    @PutMapping("/decks")
    public AnkiDeckService.DecksDto chooseDecks(@AuthenticationPrincipal AuthUser principal,
                                                @Valid @RequestBody AnkiDeckService.DecksRequest req) {
        return deckService.choose(currentUser.load(principal), req);
    }

    @DeleteMapping("/decks")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect(@AuthenticationPrincipal AuthUser principal) {
        deckService.disconnect(currentUser.load(principal));
    }

    @PostMapping("/runs")
    @ResponseStatus(HttpStatus.CREATED)
    public AnkiSyncService.RunDto start(@AuthenticationPrincipal AuthUser principal,
                                        @RequestBody AnkiSyncService.StartRequest req) {
        return syncService.start(currentUser.load(principal), req.dryRun());
    }

    @PostMapping("/runs/{id}/cards")
    public AnkiSyncService.RunDto cards(@AuthenticationPrincipal AuthUser principal, @PathVariable long id,
                                        @Valid @RequestBody AnkiSyncService.CardsRequest req) {
        return syncService.cards(currentUser.load(principal), id, req);
    }

    @PostMapping("/runs/{id}/finish")
    public AnkiSyncService.RunDto finish(@AuthenticationPrincipal AuthUser principal, @PathVariable long id,
                                         @Valid @RequestBody AnkiSyncService.FinishRequest req) {
        return syncService.finish(currentUser.load(principal), id, req.ankiDeckIds());
    }

    @GetMapping("/runs/latest")
    public ResponseEntity<AnkiSyncService.RunDto> latest(@AuthenticationPrincipal AuthUser principal) {
        return syncService.latest(currentUser.load(principal)).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/runs/{id}/words")
    public AnkiSyncService.WordsDto words(@AuthenticationPrincipal AuthUser principal, @PathVariable long id,
                                          @RequestParam String outcome) {
        return syncService.words(currentUser.load(principal), id, outcome);
    }
}
