package app.lector.text;

import app.lector.token.Language;

/** The library list filters; a null filter matches everything. */
public final class LibraryFilter {

    private LibraryFilter() {}

    public static boolean matches(Text text, MediaKind kind, Language language, Category category) {
        return (kind == null || MediaKind.of(text) == kind)
                && (language == null || text.getLanguage() == language)
                && (category == null || text.getCategory() == category);
    }
}
