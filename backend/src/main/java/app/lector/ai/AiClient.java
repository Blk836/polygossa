package app.lector.ai;

import app.lector.common.ApiException;
import app.lector.config.AppProperties;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.MissingNode;

@Component
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);

    private static final double DEFAULT_TEMPERATURE = 0.3;

    private final AppProperties.OpenAi config;
    private final RestClient http;
    private final RestClient quick;
    private final RestClient slow;
    private final String transcriptionModel;
    private final ObjectMapper json;
    private final AiSpending spending;

    public AiClient(AppProperties props, RestClient.Builder builder, ObjectMapper json, AiSpending spending,
                    @Value("${app.transcription.model:whisper-1}") String transcriptionModel,
                    @Value("${app.transcription.timeout:10m}") Duration transcriptionTimeout) {
        this.config = props.openai();
        this.json = json;
        this.spending = spending;
        this.http = client(builder, config.timeout());
        this.quick = client(builder, config.meaningTimeout());
        this.slow = client(builder, transcriptionTimeout);
        this.transcriptionModel = transcriptionModel;
    }

    private RestClient client(RestClient.Builder builder, Duration timeout) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeout);
        factory.setReadTimeout(timeout);
        return builder.clone()
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

    public String meaningModel() {
        return config.meaningModel();
    }

    public boolean systemBudgetLeft() {
        return spending.systemBudgetLeft();
    }

    public JsonNode completeJson(AiJob job, String system, String user) {
        return completeJson(job, system, user, DEFAULT_TEMPERATURE);
    }

    public record Reply(JsonNode json, long tokensIn, long tokensOut) {}

    public JsonNode completeJson(AiJob job, String system, String user, double temperature) {
        return complete(http, job, config.model(), system, user, temperature).json();
    }

    public Reply quickReply(AiJob job, String system, String user) {
        return complete(quick, job, config.meaningModel(), system, user, 0);
    }

    private Reply complete(RestClient client, AiJob job, String model, String system, String user,
                           double temperature) {
        if (!enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ai_disabled",
                    "AI features are not configured on this server (set OPENAI_API_KEY)");
        }
        if (job.system() && !spending.systemBudgetLeft()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ai_ceiling",
                    "Today's AI budget for background work is used up; it resets at midnight UTC");
        }
        int cap = job.maxTokens(user);
        Map<String, Object> request = Map.of(
                "model", model,
                "temperature", temperature,
                "max_completion_tokens", cap,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)));
        JsonNode response;
        try {
            response = client.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientException e) {
            spending.failed(job, 0, timedOut(e) ? cap : 0);
            log.warn("AI request for {} failed: {}", job, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error", "The AI service is unavailable right now");
        }
        return read(job, model, response == null ? MissingNode.getInstance() : response);
    }

    private Reply read(AiJob job, String model, JsonNode response) {
        JsonNode usage = response.path("usage");
        long tokensIn = usage.path("prompt_tokens").asLong(0);
        long tokensOut = usage.path("completion_tokens").asLong(0);
        JsonNode choice = response.path("choices").path(0);
        String content = choice.path("message").path("content").asString(null);
        log.info("AI call for {} to {} used {} tokens in, {} out", job, model, tokensIn, tokensOut);
        if (content == null || "length".equals(choice.path("finish_reason").asString(null))) {
            spending.failed(job, tokensIn, tokensOut);
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error",
                    content == null ? "The AI service returned no answer" : "The AI service's answer was cut off");
        }
        try {
            Reply reply = new Reply(json.readTree(content), tokensIn, tokensOut);
            spending.succeeded(job, tokensIn, tokensOut);
            return reply;
        } catch (tools.jackson.core.JacksonException e) {
            spending.failed(job, tokensIn, tokensOut);
            log.warn("AI returned invalid JSON for {}: {}", job, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error", "The AI service returned an unreadable answer");
        }
    }

    public JsonNode transcribe(byte[] audio, String filename) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", new ByteArrayResource(audio) {
            @Override
            public String getFilename() {
                return filename;
            }
        });
        form.add("model", transcriptionModel);
        form.add("response_format", "verbose_json");
        form.add("timestamp_granularities[]", "word");
        form.add("timestamp_granularities[]", "segment");
        try {
            JsonNode heard = slow.post().uri("/audio/transcriptions").contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form).retrieve().body(JsonNode.class);
            log.info("Transcribed {} bytes of audio with {}", audio.length, transcriptionModel);
            return heard == null ? MissingNode.getInstance() : heard;
        } catch (RestClientException e) {
            log.warn("Transcription failed: {}", e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ai_error", "The transcription service is unavailable right now");
        }
    }

    private static boolean timedOut(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SocketTimeoutException) {
                return true;
            }
        }
        return false;
    }
}
