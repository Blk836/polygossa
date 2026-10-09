package app.lector.text;

import app.lector.token.Language;

public final class LibraryFilter {

    private LibraryFilter() {}

    public static boolean matches(Text text, MediaKind kind, Language language, Category category) {
        return (kind == null || MediaKind.of(text) == kind)
                && Language.scope(language).contains(text.getLanguage())
                && (category == null || text.getCategory() == category);
    }
}
