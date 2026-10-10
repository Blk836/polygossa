package app.lector.recommend;

import app.lector.common.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class TrainingSet {

    enum Outcome {
        OPEN, HALF;

        static Outcome parse(String value) {
            for (Outcome o : values()) {
                if (o.name().toLowerCase(Locale.ROOT).equals(value)) {
                    return o;
                }
            }
            throw ApiException.badRequest("outcome must be open or half");
        }

        String code() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    record Event(long userId, long textId, boolean open, int position, double[] parts, Instant at) {}

    record Reached(int percent, boolean completed) {}

    private TrainingSet() {}

    static List<WeightLearner.Example> examples(List<Event> events, Outcome outcome, Map<String, Reached> reached) {
        Map<String, List<Event>> byItem = new LinkedHashMap<>();
        for (Event e : events) {
            byItem.computeIfAbsent(e.userId() + ":" + e.textId(), k -> new ArrayList<>()).add(e);
        }
        List<WeightLearner.Example> out = new ArrayList<>();
        byItem.forEach((key, list) -> example(list, outcome, reached.get(key)).ifPresent(out::add));
        return out;
    }

    private static java.util.Optional<WeightLearner.Example> example(List<Event> events, Outcome outcome,
                                                                      Reached reached) {
        List<Event> sorted = events.stream().sorted(Comparator.comparing(Event::at)).toList();
        Instant opened = sorted.stream().filter(Event::open).map(Event::at).findFirst().orElse(null);
        Event shown = null;
        boolean beforeOpen = false;
        for (Event e : sorted) {
            if (!e.open() && e.parts() != null) {
                boolean before = opened != null && !e.at().isAfter(opened);
                if (before || !beforeOpen) {
                    shown = e;
                    beforeOpen = before;
                }
            }
        }
        if (shown == null) {
            return java.util.Optional.empty();
        }
        boolean success = beforeOpen && (outcome == Outcome.OPEN || readHalf(reached));
        return java.util.Optional.of(new WeightLearner.Example(shown.parts(), shown.position(), success));
    }

    private static boolean readHalf(Reached reached) {
        return reached != null && (reached.completed() || reached.percent() >= 50);
    }
}
