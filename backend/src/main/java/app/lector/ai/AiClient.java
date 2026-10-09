package app.lector.ai;

import app.lector.common.ApiException;
import app.lector.config.AppProperties;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);

    private static final double DEFAULT_TEMPERATURE = 0.3;

    private final AppProperties.OpenAi config;
    private final RestClient http;
    private final ObjectMapper json;

    public AiClient(AppProperties props, RestClient.Builder builder, ObjectMapper json) {
        this.config = props.openai();
        this.json = json;
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

    public String model() {
        return config.model();
    }

    public JsonNode completeJson(String system, String user) {
        return completeJson(system, user, DEFAULT_TEMPERATURE);
    }

    public JsonNode completeJson(String system, String user, double temperature) {
        if (!enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ai_disabled",
                    "AI features are not configured on this server (set OPENAI_API_KEY)");
        }
        Map<String, Object> request = Map.of(
                "model", config.model(),
                "temperature", temperature,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)));
        try {
            JsonNode response = http.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);
            String content = response == null ? null
                    : response.path("choices").path(0).path("message").path("content").asString(null);
            log.info("AI call to {} used {} tokens", config.model(),
                    response == null ? "?" : response.path("usage").path("total_tokens").asString("?"));
            if (content == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error", "The AI service returned no answer");
            }
            return json.readTree(content);
        } catch (RestClientException e) {
            log.warn("AI request failed: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error", "The AI service is unavailable right now");
        } catch (tools.jackson.core.JacksonException e) {
            log.warn("AI returned invalid JSON: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error", "The AI service returned an unreadable answer");
        }
    }
}
