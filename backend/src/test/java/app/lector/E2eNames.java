package app.lector;

import app.lector.ai.AiClient;
import app.lector.text.PersonNames;
import app.lector.token.Language;
import app.lector.token.Token;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import tools.jackson.databind.ObjectMapper;

class E2eNames {

    static final String SUFFIX = "persona";

    @Bean
    @Primary
    PersonNames e2ePersonNames(AiClient ai, ObjectMapper json) {
        return new PersonNames(ai, json) {
            @Override
            public Set<String> find(Language language, List<Token> tokens) {
                Set<String> out = new LinkedHashSet<>();
                for (Token t : tokens) {
                    if (t.word() && Character.isUpperCase(t.text().codePointAt(0)) && t.normalized().endsWith(SUFFIX)) {
                        out.add(t.normalized());
                    }
                }
                return out;
            }
        };
    }
}
