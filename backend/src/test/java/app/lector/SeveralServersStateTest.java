package app.lector;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.recommend.FeatureCache;
import app.lector.text.TextFeature;
import app.lector.text.TextFeatureRepository;
import app.lector.user.ActiveDays;
import app.lector.user.UserDayRepository;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class SeveralServersStateTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    UserDayRepository days;

    @Autowired
    PlatformTransactionManager transactions;

    @Autowired
    Clock clock;

    @Autowired
    TextFeatureRepository features;

    @Autowired
    JdbcTemplate jdbc;

    private TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, json);
    }

    @Test
    void aLearnerSeenByTwoServersHasOneActiveDay() throws Exception {
        long userId = api.get(api.signup(), "/api/me", 200).get("id").asLong();
        ActiveDays first = new ActiveDays(days, transactions, clock);
        ActiveDays second = new ActiveDays(days, transactions, clock);
        first.seen(userId);
        second.seen(userId);
        first.seen(userId);
        Integer rows = jdbc.queryForObject("select count(*) from user_days where user_id = ?", Integer.class, userId);
        assertThat(rows).isEqualTo(1);
    }

    @Test
    void aTextsNewFeaturesAreSeenByEveryServerWithoutARestart() throws Exception {
        long textId = api.createText(api.signup(), "es", "Hola amigo.", true);
        features.saveAndFlush(new TextFeature(textId).withTags(List.of("cooking"), "s", null, "general", "m")
                .withEmbedding(new float[] {1f, 0f}, "e"));
        FeatureCache first = new FeatureCache(features);
        FeatureCache second = new FeatureCache(features);
        assertThat(first.get(List.of(textId), "e").get(textId).topics()).containsExactly("cooking");
        assertThat(second.get(List.of(textId), "e").get(textId).topics()).containsExactly("cooking");

        TextFeature changed = features.findByTextId(textId).orElseThrow();
        features.saveAndFlush(changed.withTags(List.of("travel"), "s", null, "general", "m")
                .withEmbedding(new float[] {0f, 1f}, "e"));

        for (FeatureCache server : List.of(first, second)) {
            Map<Long, FeatureCache.Features> seen = server.get(List.of(textId), "e");
            assertThat(seen.get(textId).topics()).containsExactly("travel");
            assertThat(seen.get(textId).vector()).containsExactly(0f, 1f);
        }
    }
}
