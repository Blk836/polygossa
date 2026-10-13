package app.lector.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.lookup-prices")
public record LookupPrices(
        @DefaultValue("15") double translatePerMillionCharacters,
        @DefaultValue("0.15") double aiInputPerMillionTokens,
        @DefaultValue("0.60") double aiOutputPerMillionTokens) {

    double cost(long characters, long tokensIn, long tokensOut) {
        return (characters * translatePerMillionCharacters + tokensIn * aiInputPerMillionTokens
                + tokensOut * aiOutputPerMillionTokens) / 1_000_000;
    }
}
