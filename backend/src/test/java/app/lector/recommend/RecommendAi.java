package app.lector.recommend;

import app.lector.writing.OpenAiStub;

/** Starts the OpenAI stand-in for a test class's static field. */
final class RecommendAi {

    private RecommendAi() {}

    static OpenAiStub start() {
        try {
            return new OpenAiStub();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
