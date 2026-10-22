package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.ObjectMapper;

@ApiTest
class ConcurrentProgressApiTest {

    private static final int SAVES = 8;

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void theDaysFirstProgressSavesArrivingTogetherAllSucceedAndAllCount() throws Exception {
        TestApi api = new TestApi(mvc, json);
        for (int round = 0; round < 5; round++) {
            String token = api.signupPro();
            List<Long> texts = new ArrayList<>();
            for (int i = 0; i < SAVES; i++) {
                texts.add(api.createText(token, "es", "uno dos tres cuatro cinco.", false));
            }
            CountDownLatch start = new CountDownLatch(1);
            ExecutorService pool = Executors.newFixedThreadPool(SAVES);
            try {
                List<Future<Integer>> saves = new ArrayList<>();
                for (Long text : texts) {
                    Callable<Integer> save = () -> {
                        start.await();
                        return mvc.perform(MockMvcRequestBuilders.post("/api/texts/" + text + "/progress")
                                        .header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"position\":9}"))
                                .andReturn().getResponse().getStatus();
                    };
                    saves.add(pool.submit(save));
                }
                start.countDown();
                for (Future<Integer> save : saves) {
                    assertThat(save.get()).isEqualTo(200);
                }
            } finally {
                pool.shutdown();
            }
            long user = jdbc.queryForObject("select user_id from reading_progress where text_id = ?", Long.class,
                    texts.get(0));
            assertThat(jdbc.queryForObject("select sum(words) from words_read where user_id = ?", Long.class, user))
                    .isEqualTo(SAVES * 5L);
        }
    }
}
