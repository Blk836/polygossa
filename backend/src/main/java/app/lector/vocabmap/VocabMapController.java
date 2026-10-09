package app.lector.vocabmap;

import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The vocabulary map on Progress (vocabulary-map.feature). Open to every plan. */
@RestController
@RequestMapping("/api/vocab-map")
public class VocabMapController {

    private final VocabMapService maps;
    private final CurrentUser currentUser;

    public VocabMapController(VocabMapService maps, CurrentUser currentUser) {
        this.maps = maps;
        this.currentUser = currentUser;
    }

    @GetMapping
    public VocabMapService.VocabMap map(@AuthenticationPrincipal AuthUser principal, @RequestParam Language language) {
        return maps.map(currentUser.load(principal), language);
    }
}
