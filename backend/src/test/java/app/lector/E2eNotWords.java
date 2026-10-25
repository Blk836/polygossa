package app.lector;

import app.lector.ai.AiClient;
import app.lector.text.NotWords;
import app.lector.text.WordVerdicts;
import app.lector.token.Language;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import tools.jackson.databind.ObjectMapper;

class E2eNotWords {

    static final String SUFFIX = "nonmot";

    @Bean
    @Primary
    NotWords e2eNotWords(AiClient ai, WordVerdicts verdicts, ObjectMapper json) {
        return new NotWords(ai, verdicts, json) {
            @Override
            public boolean aiEnabled() {
                return true;
            }

            @Override
            public boolean canCall() {
                return true;
            }

            @Override
            public Optional<Answer> ask(Language language, List<String> words) {
                Set<String> found = new LinkedHashSet<>();
                for (String word : words) {
                    if (word.endsWith(SUFFIX)) {
                        found.add(word);
                    }
                }
                return Optional.of(new Answer(found, 0, 0));
            }
        };
    }
}
