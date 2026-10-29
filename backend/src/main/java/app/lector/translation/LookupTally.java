package app.lector.translation;

public class LookupTally {

    private long aiCalls;
    private long aiTokensIn;
    private long aiTokensOut;
    private long aiFailures;

    public void aiCall(long tokensIn, long tokensOut) {
        aiCalls++;
        aiTokensIn += tokensIn;
        aiTokensOut += tokensOut;
    }

    public void aiFailed() {
        aiCalls++;
        aiFailures++;
    }

    public long aiCalls() { return aiCalls; }
    public long aiTokensIn() { return aiTokensIn; }
    public long aiTokensOut() { return aiTokensOut; }
    public long aiFailures() { return aiFailures; }
}
