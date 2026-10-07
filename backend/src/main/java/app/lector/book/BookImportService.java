package app.lector.book;

import app.lector.common.ApiException;
import app.lector.playlist.Playlist;
import app.lector.playlist.PlaylistService;
import app.lector.text.TextService;
import app.lector.token.Language;
import app.lector.user.PlanService;
import app.lector.user.User;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Imports a book: one private text per chapter, in order, gathered in a new private playlist named after the book.
 * All or nothing: a chapter that fails leaves no texts or playlist behind. Books are never shared from here, since
 * most are copyrighted.
 */
@Service
public class BookImportService {

    public record Imported(Long playlistId, String title, List<Long> textIds) {}

    private final TextService texts;
    private final PlaylistService playlists;
    private final PlanService plans;

    public BookImportService(TextService texts, PlaylistService playlists, PlanService plans) {
        this.texts = texts;
        this.playlists = playlists;
        this.plans = plans;
    }

    @Transactional
    public Imported importBook(User user, MultipartFile file, Language language) {
        if (language == null) {
            throw ApiException.badRequest("A language is required");
        }
        Book book = BookReader.read(bytes(file), file.getOriginalFilename());
        plans.checkCanImportTexts(user, book.chapters().size());
        String title = book.title().length() > Playlist.MAX_TITLE ? book.title().substring(0, Playlist.MAX_TITLE)
                : book.title();
        Long playlistId = playlists.create(user, title, "Imported from " + file.getOriginalFilename(), language).id();
        List<Long> ids = new ArrayList<>();
        for (Book.Chapter chapter : book.chapters()) {
            Long id = texts.createUnchecked(user, chapter.title(), language, chapter.content(), null, false, null).getId();
            playlists.addItem(user, playlistId, id);
            ids.add(id);
        }
        return new Imported(playlistId, title, ids);
    }

    private static byte[] bytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read the uploaded file");
        }
    }
}
