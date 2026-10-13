package app.lector.translation;

public class LookupTally {

    private long translateCalls;
    private long translateCharacters;
    private long translateFailures;
    private long translateCapped;
    private long aiCalls;
    private long aiTokensIn;
    private long aiTokensOut;
    private long aiFailures;

    public void translateCall(long characters) {
        translateCalls++;
        translateCharacters += characters;
    }

    public void translateFailed() {
        translateFailures++;
    }

    public void refusedByCap() {
        translateCapped++;
    }

    public void aiCall(long tokensIn, long tokensOut) {
        aiCalls++;
        aiTokensIn += tokensIn;
        aiTokensOut += tokensOut;
    }

    public void aiFailed() {
        aiCalls++;
        aiFailures++;
    }

    public long translateCalls() { return translateCalls; }
    public long translateCharacters() { return translateCharacters; }
    public long translateFailures() { return translateFailures; }
    public long translateCapped() { return translateCapped; }
    public long aiCalls() { return aiCalls; }
    public long aiTokensIn() { return aiTokensIn; }
    public long aiTokensOut() { return aiTokensOut; }
    public long aiFailures() { return aiFailures; }
}
