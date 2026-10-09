package app.lector.token;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.Locale;
import java.util.regex.Pattern;

public enum NativeLanguage {
    EN("en", "English", "English", Script.LATIN),
    ES("es", "Spanish", "Español", Script.LATIN),
    FR("fr", "French", "Français", Script.LATIN),
    DE("de", "German", "Deutsch", Script.LATIN),
    IT("it", "Italian", "Italiano", Script.LATIN),
    PT("pt", "Portuguese", "Português", Script.LATIN),
    NL("nl", "Dutch", "Nederlands", Script.LATIN),
    PL("pl", "Polish", "Polski", Script.LATIN),
    SV("sv", "Swedish", "Svenska", Script.LATIN),
    TR("tr", "Turkish", "Türkçe", Script.LATIN),
    VI("vi", "Vietnamese", "Tiếng Việt", Script.LATIN),
    ID("id", "Indonesian", "Bahasa Indonesia", Script.LATIN),
    RU("ru", "Russian", "Русский", Script.CYRILLIC),
    UK("uk", "Ukrainian", "Українська", Script.CYRILLIC),
    AR("ar", "Arabic", "العربية", Script.ARABIC),
    HI("hi", "Hindi", "हिन्दी", Script.DEVANAGARI),
    JA("ja", "Japanese", "日本語", Script.JAPANESE),
    ZH("zh", "Chinese", "中文", Script.HAN),
    KO("ko", "Korean", "한국어", Script.HANGUL);

    private enum Script {
        LATIN("\\p{IsLatin}"),
        CYRILLIC("\\p{IsCyrillic}"),
        ARABIC("\\p{IsArabic}"),
        DEVANAGARI("\\p{IsDevanagari}"),
        JAPANESE("\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}ー"),
        HAN("\\p{IsHan}"),
        HANGUL("\\p{IsHangul}");

        private final Pattern word;

        Script(String letters) {
            this.word = Pattern.compile("[" + letters + "](?:[" + letters + "\\p{M} '’\\-]*[" + letters + "\\p{M}])?");
        }
    }

    private final String code;
    private final String displayName;
    private final String nativeName;
    private final Script script;

    NativeLanguage(String code, String displayName, String nativeName, Script script) {
        this.code = code;
        this.displayName = displayName;
        this.nativeName = nativeName;
        this.script = script;
    }

    @JsonValue
    public String code() {
        return code;
    }

    public String displayName() {
        return displayName;
    }

    public String nativeName() {
        return nativeName;
    }

    public boolean writes(String word) {
        return script.word.matcher(word).matches();
    }

    @JsonCreator
    public static NativeLanguage fromCode(String code) {
        if (code == null) {
            throw new IllegalArgumentException("native language is required");
        }
        return Arrays.stream(values())
                .filter(l -> l.code.equalsIgnoreCase(code.trim()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported native language: " + code));
    }

    public static NativeLanguage fromBrowser(String tag) {
        if (tag == null || tag.isBlank()) {
            return EN;
        }
        String base = tag.strip().split("[-_]")[0].toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(l -> l.code.equals(base)).findFirst().orElse(EN);
    }
}
