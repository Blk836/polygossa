package app.lector.anki;

import app.lector.token.Language;
import app.lector.token.TokenizationService;
import java.util.Locale;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;

final class AnkiCardText {

    enum Skip { EMPTY, TOO_LONG, MEDIA }

    record Word(String term, String display, Skip skip) {
        static Word skipped(Skip skip) {
            return new Word(null, null, skip);
        }
    }

    static final int MAX_WORDS = 12;
    static final int MAX_CHARS = 100;
    static final int MAX_MEANING = 2000;
    private static final Pattern SOUND = Pattern.compile("\\[sound:[^\\]]*]");
    private static final Pattern SPACES = Pattern.compile("\\s+");

    private AnkiCardText() {}

    static Word word(String field, Language language) {
        if (field == null) {
            return Word.skipped(Skip.EMPTY);
        }
        String text = plain(field);
        if (text.isEmpty()) {
            return Word.skipped(hasMedia(field) ? Skip.MEDIA : Skip.EMPTY);
        }
        if (text.length() > MAX_CHARS || text.split(" ").length > MAX_WORDS) {
            return Word.skipped(Skip.TOO_LONG);
        }
        return new Word(TokenizationService.normalize(text, language), text, null);
    }

    static String meaning(String field) {
        if (field == null) {
            return null;
        }
        String text = plain(field);
        if (text.isEmpty()) {
            return null;
        }
        return text.length() > MAX_MEANING ? text.substring(0, MAX_MEANING) : text;
    }

    static String plain(String field) {
        String text = Jsoup.parse(SOUND.matcher(field).replaceAll(" ")).text().replace(' ', ' ');
        return SPACES.matcher(text).replaceAll(" ").strip();
    }

    private static boolean hasMedia(String field) {
        return field.contains("[sound:") || field.toLowerCase(Locale.ROOT).contains("<img");
    }
}
