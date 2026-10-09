package app.lector.token;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record Token(int index, String text, boolean word, String normalized, String lemma, String reading, int sentence) {}
