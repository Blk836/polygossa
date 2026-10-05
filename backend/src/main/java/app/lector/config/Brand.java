package app.lector.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * The product name people see (starter-library owner, Anki exports). Set {@code BRAND_NAME} to rename the app; the
 * frontend reads the same variable. Internal identifiers (package, cookies, database, test emails) don't follow it.
 */
@ConfigurationProperties(prefix = "app.brand")
public record Brand(@DefaultValue(Brand.DEFAULT) String name) {

    public static final String DEFAULT = "Polygossa";

    /** A blank setting (e.g. {@code BRAND_NAME=} passed through by docker compose) means the default. */
    public Brand {
        name = name == null || name.isBlank() ? DEFAULT : name.strip();
    }

    /** Display name of the system account that owns the starter texts. */
    public String libraryName() {
        return name + " Library";
    }
}
