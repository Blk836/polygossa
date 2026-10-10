package app.lector.anki;

import app.lector.TestApi;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

final class AnkiApi {

    static final long DECK = 1_500_000_001L;

    private final TestApi api;
    private final ObjectMapper json;

    AnkiApi(TestApi api, ObjectMapper json) {
        this.api = api;
        this.json = json;
    }

    static Map<String, Object> mature(String word) {
        return card(word, 2, 30, null);
    }

    static Map<String, Object> young(String word) {
        return card(word, 2, 3, null);
    }

    static Map<String, Object> fresh(String word) {
        return card(word, 0, 0, null);
    }

    static Map<String, Object> card(String word, int type, int interval, String meaning) {
        Map<String, Object> card = new LinkedHashMap<>();
        card.put("word", word);
        card.put("type", type);
        card.put("interval", interval);
        if (meaning != null) {
            card.put("meaning", meaning);
        }
        return card;
    }

    static Map<String, Object> deck(long id, String language) {
        Map<String, Object> deck = new LinkedHashMap<>();
        deck.put("ankiDeckId", id);
        deck.put("name", "Deck " + id);
        deck.put("language", language);
        deck.put("wordField", "Word");
        deck.put("meaningField", "Definition");
        return deck;
    }

    JsonNode chooseDecks(String token, List<Map<String, Object>> decks, int status) throws Exception {
        return api.put(token, "/api/anki/decks", json.writeValueAsString(Map.of("decks", decks)), status);
    }

    void chooseSpanish(String token) throws Exception {
        chooseDecks(token, List.of(deck(DECK, "es")), 200);
    }

    long start(String token, boolean dryRun) throws Exception {
        return api.post(token, "/api/anki/runs", "{\"dryRun\":" + dryRun + "}", 201).get("id").asLong();
    }

    JsonNode send(String token, long run, long deck, List<Map<String, Object>> cards, int status) throws Exception {
        String body = json.writeValueAsString(Map.of("ankiDeckId", deck, "cards", cards));
        return api.post(token, "/api/anki/runs/" + run + "/cards", body, status);
    }

    JsonNode finish(String token, long run, List<Long> decks) throws Exception {
        return api.post(token, "/api/anki/runs/" + run + "/finish",
                json.writeValueAsString(Map.of("ankiDeckIds", decks)), 200);
    }

    @SafeVarargs
    final JsonNode sync(String token, Map<String, Object>... cards) throws Exception {
        return run(token, false, cards);
    }

    @SafeVarargs
    final JsonNode preview(String token, Map<String, Object>... cards) throws Exception {
        return run(token, true, cards);
    }

    @SafeVarargs
    private JsonNode run(String token, boolean dryRun, Map<String, Object>... cards) throws Exception {
        long run = start(token, dryRun);
        send(token, run, DECK, List.of(cards), 200);
        return finish(token, run, List.of(DECK));
    }

    List<String> words(String token, long run, String outcome) throws Exception {
        List<String> out = new ArrayList<>();
        api.get(token, "/api/anki/runs/" + run + "/words?outcome=" + outcome, 200).get("words")
                .forEach(w -> out.add(w.asString()));
        return out;
    }

    Map<String, String> statuses(String token, String language) throws Exception {
        JsonNode items = api.get(token, "/api/vocabulary?size=500&language=" + language, 200).get("items");
        Map<String, String> out = new LinkedHashMap<>();
        items.forEach(i -> out.put(i.get("term").asString(), i.get("status").asString()));
        return out;
    }

    JsonNode entry(String token, String language, String term) throws Exception {
        JsonNode items = api.get(token, "/api/vocabulary?size=500&language=" + language, 200).get("items");
        for (JsonNode i : items) {
            if (i.get("term").asString().equals(term)) {
                return i;
            }
        }
        return null;
    }

    JsonNode save(String token, String term, String status) throws Exception {
        return api.post(token, "/api/vocabulary",
                "{\"language\":\"es\",\"term\":\"" + term + "\",\"status\":\"" + status + "\"}", 201);
    }

    void setStatus(String token, String term, String status) throws Exception {
        long id = entry(token, "es", term).get("id").asLong();
        api.patch(token, "/api/vocabulary/" + id, "{\"status\":\"" + status + "\"}", 200);
    }

    static Map<String, Integer> counts(JsonNode run) {
        return List.of("cards", "becameKnown", "addedKnown", "addedLearning", "overLimit", "skippedEmpty",
                        "skippedTooLong", "skippedMedia", "leaveReview").stream()
                .collect(Collectors.toMap(k -> k, k -> run.get(k).asInt(), (a, b) -> a, LinkedHashMap::new));
    }
}
