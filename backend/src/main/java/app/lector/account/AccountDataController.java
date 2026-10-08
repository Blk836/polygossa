package app.lector.account;

import app.lector.config.Brand;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The account's own data (docs/acceptance/gdpr.feature): download all of it, or delete the account. */
@RestController
@RequestMapping("/api/me")
public class AccountDataController {

    /** The account's email, typed again to confirm. */
    public record DeleteRequest(String confirmEmail) {}

    private final CurrentUser currentUser;
    private final AccountExport export;
    private final AccountDeletion deletion;
    private final Brand brand;

    public AccountDataController(CurrentUser currentUser, AccountExport export, AccountDeletion deletion, Brand brand) {
        this.currentUser = currentUser;
        this.export = export;
        this.deletion = deletion;
        this.brand = brand;
    }

    @GetMapping("/export")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> export(@AuthenticationPrincipal AuthUser principal) {
        String name = brand.name().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-") + "-data.json";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
                .body(export.export(currentUser.load(principal)));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal AuthUser principal, @RequestBody(required = false) DeleteRequest req) {
        deletion.delete(currentUser.load(principal), req == null ? null : req.confirmEmail());
    }
}
