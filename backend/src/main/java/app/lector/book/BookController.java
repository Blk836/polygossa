package app.lector.book;

import app.lector.token.Language;
import app.lector.user.AuthUser;
import app.lector.user.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Import › Book: an EPUB or PDF becomes a private playlist of chapter texts. */
@RestController
public class BookController {

    private final BookImportService books;
    private final CurrentUser currentUser;

    public BookController(BookImportService books, CurrentUser currentUser) {
        this.books = books;
        this.currentUser = currentUser;
    }

    @PostMapping(value = "/api/texts/import-book", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public BookImportService.Imported importBook(@AuthenticationPrincipal AuthUser principal,
                                                 @RequestPart("file") MultipartFile file,
                                                 @RequestParam("language") Language language) {
        return books.importBook(currentUser.load(principal), file, language);
    }
}
