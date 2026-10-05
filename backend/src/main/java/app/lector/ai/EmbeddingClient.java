package app.lector.ai;

import app.lector.config.AppProperties;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

/** Minimal client for an OpenAI-compatible /embeddings endpoint: one text in, one vector out. */
@Component
public class EmbeddingClient {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingClient.class);

    /** Why an embedding couldn't be made: the service failed or answered without a usable vector. */
    public static class EmbeddingException extends RuntimeException {
        public EmbeddingException(String message) {
            super(message);
        }
    }

    private final AppProperties.OpenAi config;
    private final RestClient http;

    public EmbeddingClient(AppProperties props, RestClient.Builder builder) {
        this.config = props.openai();
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(config.timeout());
        factory.setReadTimeout(config.timeout());
        this.http = builder.clone()
                .baseUrl(config.baseUrl())
                .defaultHeader("Authorization", "Bearer " + config.apiKey())
                .requestFactory(factory)
                .build();
    }

    public boolean enabled() {
        return config.enabled();
    }

    /** The model vectors come from; vectors of different models must not be compared. */
    public String model() {
        return config.embeddingModel();
    }

    public float[] embed(String input) {
        JsonNode response;
        try {
            response = http.post()
                    .uri("/embeddings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("model", model(), "input", input))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException | tools.jackson.core.JacksonException e) {
            throw new EmbeddingException("embedding request failed: " + e.getMessage());
        }
        JsonNode values = response == null ? null : response.path("data").path(0).path("embedding");
        float[] vector = vector(values);
        log.info("Embedding with {} used {} tokens", model(), response.path("usage").path("total_tokens").asString("?"));
        return vector;
    }

    /** The numbers of a JSON array; refuses anything else, including an empty array. */
    static float[] vector(JsonNode values) {
        if (values == null || !values.isArray() || values.isEmpty()) {
            throw new EmbeddingException("no embedding in the answer");
        }
        float[] vector = new float[values.size()];
        for (int i = 0; i < vector.length; i++) {
            JsonNode v = values.get(i);
            if (!v.isNumber()) {
                throw new EmbeddingException("the embedding holds a non-number");
            }
            vector[i] = v.floatValue();
        }
        return vector;
    }
}
