package app.lector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import app.lector.user.AuthController;
import app.lector.user.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "test.database=devloginrace",
        "app.seed-samples=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class DevLoginRaceTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    UserRepository users;

    @Test
    void simultaneousFirstLoginsAllSucceedWithOneAccount() throws Exception {
        assertThat(users.findByEmailIgnoreCase(AuthController.DEV_EMAIL)).isEmpty();
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            List<Callable<Integer>> logins = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                logins.add(() -> mvc.perform(post("/api/auth/dev-login")).andReturn().getResponse().getStatus());
            }
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : pool.invokeAll(logins)) {
                statuses.add(f.get());
            }
            assertThat(statuses).containsOnly(200);
        } finally {
            pool.shutdown();
        }
        assertThat(users.findAll().stream().filter(u -> u.getEmail().equals(AuthController.DEV_EMAIL))).hasSize(1);
    }
}
