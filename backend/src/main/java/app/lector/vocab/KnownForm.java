package app.lector.vocab;

import app.lector.token.Language;

public record KnownForm(Language language, String term, String lemma) {}
