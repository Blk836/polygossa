package app.lector.level;

import app.lector.common.ApiException;
import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import app.lector.user.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The learner's Reading, Listening and Writing levels in a language (the Progress tab). Open to every plan. */
@RestController
@RequestMapping("/api/levels")
public class SkillLevelController {

    private final SkillLevelService levels;
    private final CurrentUser currentUser;

    public SkillLevelController(SkillLevelService levels, CurrentUser currentUser) {
        this.levels = levels;
        this.currentUser = currentUser;
    }

    /** Levels in {@code language}, or in the learner's target language when none is given. */
    @GetMapping
    public SkillLevelService.Levels levels(@AuthenticationPrincipal AuthUser principal,
                                           @RequestParam(required = false) Language language) {
        User user = currentUser.load(principal);
        Language chosen = language != null ? language : user.getTargetLanguage();
        if (chosen == null) {
            throw ApiException.badRequest("Choose a language to see levels for");
        }
        return levels.levels(user, chosen);
    }
}
