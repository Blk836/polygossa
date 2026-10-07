package app.lector.text;

import app.lector.token.Language;

/** The library list filters; a null filter matches everything, except that no language means only offered ones. */
public final class LibraryFilter {

    private LibraryFilter() {}

    public static boolean matches(Text text, MediaKind kind, Language language, Category category) {
        return (kind == null || MediaKind.of(text) == kind)
                && Language.scope(language).contains(text.getLanguage())
                && (category == null || text.getCategory() == category);
    }
}
