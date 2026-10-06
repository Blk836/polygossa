package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/** Feature: A fast e2e suite, deleting many words at once (docs/acceptance/e2e-speed.feature). */
@ApiTest
class VocabularyBulkDeleteTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    TestApi api;
    String me;

    @BeforeEach
    void setUp() throws Exception {
        api = new TestApi(mvc, json);
        me = api.signupPro();
    }

    private long save(String user, String term) throws Exception {
        return api.post(user, "/api/vocabulary", "{\"language\":\"fr\",\"term\":\"" + term + "\",\"status\":\"known\"}", 201)
                .get("id").asLong();
    }

    private long count(String user) throws Exception {
        return api.get(user, "/api/vocabulary?language=fr", 200).get("total").asLong();
    }

    private static String ids(List<Long> ids) {
        return "{\"ids\":[" + ids.stream().map(String::valueOf).collect(Collectors.joining(",")) + "]}";
    }

    @Test
    void deletesMyEntriesInOneRequest() throws Exception {
        List<Long> mine = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            mine.add(save(me, "mot" + (char) ('a' + i)));
        }
        long kept = save(me, "garde");
        var reply = api.post(me, "/api/vocabulary/delete", ids(mine), 200);
        assertThat(reply.get("deleted").asInt()).isEqualTo(5);
        assertThat(count(me)).isEqualTo(1);
        api.get(me, "/api/vocabulary/" + kept, 200);
    }

    @Test
    void otherLearnersEntriesAndUnknownIdsAreIgnored() throws Exception {
        String other = api.signupPro();
        long theirs = save(other, "autre");
        long mine = save(me, "mien");
        var reply = api.post(me, "/api/vocabulary/delete", ids(List.of(theirs, mine, 999_999_999L)), 200);
        assertThat(reply.get("deleted").asInt()).isEqualTo(1);
        assertThat(count(other)).isEqualTo(1);
        assertThat(count(me)).isZero();
    }

    @Test
    void invalidRequestsAreRejectedAndDeleteNothing() throws Exception {
        long mine = save(me, "reste");
        api.post(me, "/api/vocabulary/delete", "{}", 400);
        api.post(me, "/api/vocabulary/delete", "{\"ids\":[]}", 400);
        api.post(me, "/api/vocabulary/delete", "{\"ids\":[" + mine + ",null]}", 400);
        api.post(me, "/api/vocabulary/delete", ids(LongStream.rangeClosed(1, 1001).boxed().toList()), 400);
        assertThat(count(me)).isEqualTo(1);
        api.post(me, "/api/vocabulary/delete", ids(LongStream.rangeClosed(mine, mine + 999).boxed().toList()), 200);
        assertThat(count(me)).isZero();
    }
}
