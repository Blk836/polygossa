package app.lector.admin;

import app.lector.ai.AiJob;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.lookup-prices")
public record LookupPrices(
        @DefaultValue("15") double translatePerMillionCharacters,
        @DefaultValue("0.15") double aiInputPerMillionTokens,
        @DefaultValue("0.60") double aiOutputPerMillionTokens,
        @DefaultValue("2") double notWordsInputPerMillionTokens,
        @DefaultValue("8") double notWordsOutputPerMillionTokens) {

    double cost(long characters, long tokensIn, long tokensOut) {
        return (characters * translatePerMillionCharacters + tokensIn * aiInputPerMillionTokens
                + tokensOut * aiOutputPerMillionTokens) / 1_000_000;
    }

    double cost(AiJob job, long tokensIn, long tokensOut) {
        return job == AiJob.NOT_WORDS
                ? (tokensIn * notWordsInputPerMillionTokens + tokensOut * notWordsOutputPerMillionTokens) / 1_000_000
                : cost(0, tokensIn, tokensOut);
    }
}
