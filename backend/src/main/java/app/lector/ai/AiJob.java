package app.lector.ai;

public enum AiJob {
    DEFINITION(false, 600, 0),
    EXAMPLE(false, 200, 0),
    TRANSLATION(false, 200, 1),
    WRITING_FEEDBACK(false, 600, 2),
    WRITING_GRADE(false, 1000, 2),
    WORD_MEANING(false, 200, 0),
    CONTENT_REVIEW(false, 150, 0),
    TOPIC_TAGS(true, 400, 0);

    private final boolean system;
    private final int baseTokens;
    private final int tokensPerCharacter;

    AiJob(boolean system, int baseTokens, int tokensPerCharacter) {
        this.system = system;
        this.baseTokens = baseTokens;
        this.tokensPerCharacter = tokensPerCharacter;
    }

    public boolean system() {
        return system;
    }

    public int maxTokens(String input) {
        return baseTokens + tokensPerCharacter * input.length();
    }
}
