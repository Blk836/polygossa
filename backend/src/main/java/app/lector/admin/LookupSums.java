package app.lector.admin;

import app.lector.translation.LookupCounterRepository;
import app.lector.translation.LookupLayer;

public final class LookupSums {

    public record Layers(long aiStored, long aiNew, long community, long machineStored, long machineNew, long none) {}

    public record Stored(long machineWords, long machineNoUse, long sentenceMeanings, long communityWords) {}

    public record Row(String source, String target, long lookups, Layers layers, Double hitRate, long translateCalls,
                      long translateCharacters, long translateFailures, long translateCapped, long aiCalls,
                      long aiTokensIn, long aiTokensOut, long aiFailures, double cost, Double costPer1000Lookups,
                      Stored stored) {}

    private final long[] layers = new long[LookupLayer.values().length];
    private long translateCalls;
    private long translateCharacters;
    private long translateFailures;
    private long translateCapped;
    private long aiCalls;
    private long aiTokensIn;
    private long aiTokensOut;
    private long aiFailures;
    private long machineWords;
    private long machineNoUse;
    private long sentenceMeanings;
    private long communityWords;

    void add(LookupCounterRepository.Sums s) {
        layers[LookupLayer.valueOf(s.getLayer()).ordinal()] += s.getLookups();
        translateCalls += s.getTranslateCalls();
        translateCharacters += s.getTranslateCharacters();
        translateFailures += s.getTranslateFailures();
        translateCapped += s.getTranslateCapped();
        aiCalls += s.getAiCalls();
        aiTokensIn += s.getAiTokensIn();
        aiTokensOut += s.getAiTokensOut();
        aiFailures += s.getAiFailures();
    }

    void add(LookupSums o) {
        for (int i = 0; i < layers.length; i++) {
            layers[i] += o.layers[i];
        }
        translateCalls += o.translateCalls;
        translateCharacters += o.translateCharacters;
        translateFailures += o.translateFailures;
        translateCapped += o.translateCapped;
        aiCalls += o.aiCalls;
        aiTokensIn += o.aiTokensIn;
        aiTokensOut += o.aiTokensOut;
        aiFailures += o.aiFailures;
        machineWords += o.machineWords;
        machineNoUse += o.machineNoUse;
        sentenceMeanings += o.sentenceMeanings;
        communityWords += o.communityWords;
    }

    void machineWords(long words, long noUse) {
        machineWords += words;
        machineNoUse += noUse;
    }

    void sentenceMeanings(long n) {
        sentenceMeanings += n;
    }

    void communityWords(long n) {
        communityWords += n;
    }

    long lookups() {
        long n = 0;
        for (long l : layers) {
            n += l;
        }
        return n;
    }

    Layers layers() {
        return new Layers(layer(LookupLayer.AI_STORED), layer(LookupLayer.AI_NEW), layer(LookupLayer.COMMUNITY),
                layer(LookupLayer.MACHINE_STORED), layer(LookupLayer.MACHINE_NEW), layer(LookupLayer.NONE));
    }

    double cost(LookupPrices prices) {
        return prices.cost(translateCharacters, aiTokensIn, aiTokensOut);
    }

    Row row(String source, String target, LookupPrices prices) {
        long lookups = lookups();
        double cost = cost(prices);
        Double hitRate = lookups == 0 ? null : (double) (layer(LookupLayer.AI_STORED) + layer(LookupLayer.COMMUNITY)
                + layer(LookupLayer.MACHINE_STORED)) / lookups;
        return new Row(source, target, lookups, layers(), hitRate, translateCalls, translateCharacters,
                translateFailures, translateCapped, aiCalls, aiTokensIn, aiTokensOut, aiFailures, cost,
                lookups == 0 ? null : cost * 1000 / lookups,
                new Stored(machineWords, machineNoUse, sentenceMeanings, communityWords));
    }

    private long layer(LookupLayer l) {
        return layers[l.ordinal()];
    }
}
