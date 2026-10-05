package app.lector.recommend;

import org.springframework.boot.context.properties.bind.DefaultValue;

/** How much each part of a recommendation score counts (app.recommend.weights.*). */
public record Weights(
        /* cosine(taste vector, text vector): "more like what you read" (needs embeddings) */
        @DefaultValue("1.0") double interest,
        /* how much the learner likes the text's topic tags and category */
        @DefaultValue("0.8") double topic,
        /* known-word share near 95% */
        @DefaultValue("1.0") double comprehend,
        /* text level against the learner's Reading level */
        @DefaultValue("0.6") double level,
        /* log(1 + likes in the last 30 days) */
        @DefaultValue("0.15") double popular,
        /* newer content first, halving every half-life */
        @DefaultValue("0.3") double fresh,
        /* video or text, and length, like what they enjoy */
        @DefaultValue("0.3") double format) {
}
