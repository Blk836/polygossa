package app.lector.book;

import app.lector.common.ApiException;
import app.lector.text.TextService;

/** Recognises an uploaded book by its first bytes (a zip is an EPUB, "%PDF" a PDF) and reads its chapters. */
public final class BookReader {

    static final int MAX_CHAPTERS = 300;

    private BookReader() {}

    public static Book read(byte[] bytes, String fileName) {
        String fallback = fileName == null || fileName.isBlank() ? "Book" : fileName.replaceAll("\\.[^.]+$", "").strip();
        Book book;
        if (startsWith(bytes, "PK")) {
            book = EpubReader.read(bytes, fallback, TextService.MAX_CONTENT_CHARS);
        } else if (startsWith(bytes, "%PDF")) {
            book = PdfReader.read(bytes, fallback, TextService.MAX_CONTENT_CHARS);
        } else {
            throw ApiException.badRequest("Upload an EPUB or a PDF");
        }
        if (book.chapters().isEmpty()) {
            throw ApiException.badRequest("This book has no text to read");
        }
        if (book.chapters().size() > MAX_CHAPTERS) {
            throw ApiException.badRequest("Books are imported as at most " + MAX_CHAPTERS + " chapters; this one has "
                    + book.chapters().size());
        }
        return book;
    }

    private static boolean startsWith(byte[] bytes, String magic) {
        if (bytes.length < magic.length()) {
            return false;
        }
        for (int i = 0; i < magic.length(); i++) {
            if (bytes[i] != magic.charAt(i)) {
                return false;
            }
        }
        return true;
    }
}
