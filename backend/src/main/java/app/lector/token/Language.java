package app.lector.token;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

/** MVP languages. Space-delimited languages are tokenized in Java; the rest go to the CJK sidecar. */
public enum Language {
    ES("es", "Spanish", "es-ES", true),
    FR("fr", "French", "fr-FR", true),
    DE("de", "German", "de-DE", true),
    IT("it", "Italian", "it-IT", true),
    PT("pt", "Portuguese", "pt-PT", true),
    JA("ja", "Japanese", "ja-JP", false),
    ZH("zh", "Chinese", "zh-CN", false),
    KO("ko", "Korean", "ko-KR", false);

    private final String code;
    private final String displayName;
    private final String speechLocale;
    private final boolean spaceDelimited;

    Language(String code, String displayName, String speechLocale, boolean spaceDelimited) {
        this.code = code;
        this.displayName = displayName;
        this.speechLocale = speechLocale;
        this.spaceDelimited = spaceDelimited;
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
