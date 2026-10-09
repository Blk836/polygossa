package app.lector.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.brand")
public record Brand(@DefaultValue(Brand.DEFAULT) String name) {

    public static final String DEFAULT = "Polygossa";

    public Brand {
        name = name == null || name.isBlank() ? DEFAULT : name.strip();
    }

    public String libraryName() {
        return name + " Library";
    }
}
