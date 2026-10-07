package app.lector.token;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.List;

/**
 * The languages the app knows, English first. Only {@link #offered()} ones can be learned: Japanese, Chinese and Korean
 * are paused (docs/acceptance/learning-languages.feature) because their built-in word splitting is too crude, but rows
 * stored in them are kept. Incoming codes go through {@link #parse}, which refuses a paused language; {@link #fromCode}
 * accepts every known one.
 */
public enum Language {
    EN("en", "English", "en-US", true, true),
    ES("es", "Spanish", "es-ES", true, true),
    FR("fr", "French", "fr-FR", true, true),
    DE("de", "German", "de-DE", true, true),
    IT("it", "Italian", "it-IT", true, true),
    PT("pt", "Portuguese", "pt-PT", true, true),
    JA("ja", "Japanese", "ja-JP", false, false),
    ZH("zh", "Chinese", "zh-CN", false, false),
    KO("ko", "Korean", "ko-KR", false, false);

    private static final List<Language> OFFERED = Arrays.stream(values()).filter(l -> l.offered).toList();

    /** A request named a language that exists but isn't offered for learning. */
    public static final class NotOfferedException extends IllegalArgumentException {
        NotOfferedException(Language language) {
            super(language.displayName + " isn't offered for learning yet.");
        }
    }

    private final String code;
    private final String displayName;
    private final String speechLocale;
    private final boolean spaceDelimited;
    private final boolean offered;

    Language(String code, String displayName, String speechLocale, boolean spaceDelimited, boolean offered) {
        this.code = code;
        this.displayName = displayName;
        this.speechLocale = speechLocale;
        this.spaceDelimited = spaceDelimited;
        this.offered = offered;
    }

    @JsonValue
    public String code() {
        return code;
    }

    public String displayName() {
        return displayName;
    }

    public String speechLocale() {
        return speechLocale;
    }

    public boolean spaceDelimited() {
        return spaceDelimited;
    }

    public boolean isOffered() {
        return offered;
    }

    /** The languages that can be learned, English first. */
    public static List<Language> offered() {
        return OFFERED;
    }

    /** What a list filtered by {@code language} may show: that language, or (null) every offered one. */
    public static List<Language> scope(Language language) {
        return language == null ? OFFERED : List.of(language);
    }

    /** A language from a request (JSON or parameter): any known code, but only an offered language. */
    @JsonCreator
    public static Language parse(String code) {
        Language language = fromCode(code);
        if (!language.offered) {
            throw new NotOfferedException(language);
        }
        return language;
    }

    public static Language fromCode(String code) {
        if (code == null) {
            throw new IllegalArgumentException("language is required");
        }
        return Arrays.stream(values())
                .filter(l -> l.code.equalsIgnoreCase(code.trim()) || l.name().equalsIgnoreCase(code.trim()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported language: " + code));
    }
}
