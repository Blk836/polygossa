package app.lector.writing;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;

public final class PromptBank {

    public record Prompt(String id, String situation) {}

    private final List<Prompt> prompts;

    private PromptBank(List<Prompt> prompts) {
        this.prompts = List.copyOf(prompts);
    }

    public static PromptBank load() {
        List<Prompt> out = new ArrayList<>();
        try (InputStream in = new ClassPathResource("writing/prompts.txt").getInputStream()) {
            for (String line : new String(in.readAllBytes(), StandardCharsets.UTF_8).split("\\R")) {
                int bar = line.indexOf('|');
                if (!line.startsWith("#") && bar > 0) {
                    out.add(new Prompt(line.substring(0, bar).strip(), line.substring(bar + 1).strip()));
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return new PromptBank(out);
    }

    public List<Prompt> forLevel(String level) {
        return prompts.stream().filter(p -> p.id().startsWith(level + "-")).toList();
    }

    public Prompt pick(String level, Set<String> recent, Random random) {
        List<Prompt> all = forLevel(level);
        List<Prompt> fresh = all.stream().filter(p -> !recent.contains(p.id())).toList();
        List<Prompt> from = fresh.isEmpty() ? all : fresh;
        return from.get(random.nextInt(from.size()));
    }
}
