package app.lector.video;

import app.lector.ai.AiClient;
import app.lector.ai.AiJob;
import app.lector.text.SubtitleParser;
import app.lector.text.SubtitleParser.Cue;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import app.lector.video.TidyLines.Part;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Function;
import java.util.stream.IntStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class TranscriptTidy {

    private static final Logger log = LoggerFactory.getLogger(TranscriptTidy.class);

    static final int CHUNK_WORDS = 400;
    private static final int PARALLEL = 6;

    static final String INSTRUCTIONS = "Restore punctuation and capital letters in an automatic speech transcript. "
            + "You get JSON {\"language\", \"lines\"}: the caption lines of a video, in order. A caption line is not "
            + "a sentence: sentences usually run across several lines, and most lines end mid-sentence without any "
            + "punctuation. Reply with JSON {\"lines\": [...]}, exactly one string per input line, in the same order. "
            + "Each keeps exactly the same words in the same order as its input line: only add punctuation (full "
            + "stops, commas, question and exclamation marks, colons, quotation marks, and the language's own marks "
            + "such as Spanish ¿ and ¡) where the sentence needs it, and change letters between upper and lower case. "
            + "Never add, remove, correct, translate, join or split words, and never move a word to another line, "
            + "even one that looks misheard. Keep filler words such as euh, um or äh, and bracketed sound tags such "
            + "as [Musique], as they are.";

    public record Result(SubtitleParser.Parsed parsed, int lines, int changedLines) {}

    private final AiClient ai;
    private final TokenizationService tokenizer;
    private final ObjectMapper json;

    public TranscriptTidy(AiClient ai, TokenizationService tokenizer, ObjectMapper json) {
        this.ai = ai;
        this.tokenizer = tokenizer;
        this.json = json;
    }

    public SubtitleParser.Parsed tidy(Language language, boolean automatic, List<Cue> cues) {
        return automatic ? tidyAutomatic(language, cues).parsed() : SubtitleParser.join(cues);
    }

    public Result tidyAutomatic(Language language, List<Cue> cues) {
        Function<String, List<Token>> tokenize = text -> tokenizer.tokenize(language, text);
        String separator = language.spaceDelimited() ? " " : "";
        try {
            List<List<Cue>> chunks = chunks(cues, tokenize);
            List<Integer> bare = IntStream.range(0, chunks.size())
                    .filter(i -> TidyLines.unpunctuated(chunks.get(i), tokenize)).boxed().toList();
            List<Part> parts = new ArrayList<>(chunks.stream().map(c -> new Part(c, Set.of(), true)).toList());
            bare.forEach(i -> parts.set(i, Part.untidied(chunks.get(i))));
            if (!bare.isEmpty() && ai.enabled() && ai.systemBudgetLeft()) {
                List<Part> answers = ask(language, bare.stream().map(chunks::get).toList(), tokenize);
                for (int k = 0; k < bare.size(); k++) {
                    parts.set(bare.get(k), answers.get(k));
                }
                log.info("Tidied {} of {} parts of a transcript", answers.stream().filter(Part::tidied).count(),
                        answers.size());
            }
            return result(cues, TidyLines.join(TidyLines.paragraphs(parts, tokenize), separator));
        } catch (RuntimeException e) {
            log.warn("Could not tidy a transcript: {}", e.getMessage());
            return result(cues, SubtitleParser.join(cues));
        }
    }

    private static Result result(List<Cue> original, SubtitleParser.Parsed parsed) {
        int changed = 0;
        for (int i = 0; i < original.size(); i++) {
            if (!original.get(i).text().equals(parsed.cues().get(i).text())) {
                changed++;
            }
        }
        return new Result(parsed, original.size(), changed);
    }

    static List<List<Cue>> chunks(List<Cue> cues, Function<String, List<Token>> tokenize) {
        List<List<Cue>> out = new ArrayList<>();
        List<Cue> current = new ArrayList<>();
        int words = 0;
        for (Cue cue : cues) {
            int count = TidyLines.wordCount(cue.text(), tokenize);
            if (!current.isEmpty() && words + count > CHUNK_WORDS) {
                out.add(current);
                current = new ArrayList<>();
                words = 0;
            }
            current.add(cue);
            words += count;
        }
        if (!current.isEmpty()) {
            out.add(current);
        }
        return out;
    }

    private List<Part> ask(Language language, List<List<Cue>> chunks, Function<String, List<Token>> tokenize) {
        try (ExecutorService pool = Executors.newFixedThreadPool(Math.min(PARALLEL, chunks.size()))) {
            List<Future<Part>> answers = chunks.stream()
                    .map(chunk -> pool.submit(() -> part(language, chunk, tokenize)))
                    .toList();
            List<Part> out = new ArrayList<>();
            for (int i = 0; i < chunks.size(); i++) {
                out.add(await(answers.get(i), chunks.get(i)));
            }
            return out;
        }
    }

    private static Part await(Future<Part> answer, List<Cue> chunk) {
        try {
            return answer.get();
        } catch (ExecutionException e) {
            return Part.untidied(chunk);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Part.untidied(chunk);
        }
    }

    private Part part(Language language, List<Cue> chunk, Function<String, List<Token>> tokenize) {
        try {
            String request = json.writeValueAsString(Map.of("language", language.displayName(),
                    "lines", chunk.stream().map(Cue::text).toList()));
            JsonNode answer = ai.completeJson(AiJob.TRANSCRIPT_TIDY, INSTRUCTIONS, request, 0);
            return TidyLines.apply(chunk, strings(answer.path("lines")), tokenize)
                    .map(cues -> new Part(cues, Set.of(), true))
                    .orElseGet(() -> {
                        log.info("A tidied transcript part had the wrong number of lines; keeping the original");
                        return Part.untidied(chunk);
                    });
        } catch (RuntimeException e) {
            log.warn("Could not tidy a transcript part: {}", e.getMessage());
            return Part.untidied(chunk);
        }
    }

    private static List<String> strings(JsonNode array) {
        if (!array.isArray()) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (JsonNode item : array) {
            if (!item.isString()) {
                return null;
            }
            out.add(item.asString());
        }
        return out;
    }
}
