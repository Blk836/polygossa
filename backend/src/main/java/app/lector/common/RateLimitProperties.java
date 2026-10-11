package app.lector.common;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.rate-limits")
public record RateLimitProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("120") int lookupsPerMinute,
        @DefaultValue("60") int importsPerHour) {}
