package app.lector.recommend;

import app.lector.writing.OpenAiStub;

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
