package app.lector.recommend;

import org.springframework.boot.context.properties.bind.DefaultValue;

public record Weights(
        @DefaultValue("1.0") double interest,
        @DefaultValue("0.8") double topic,
        @DefaultValue("1.0") double comprehend,
        @DefaultValue("0.6") double level,
        @DefaultValue("0.15") double popular,
        @DefaultValue("0.3") double fresh,
        @DefaultValue("0.3") double format) {
}
