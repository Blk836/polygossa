package app.lector;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** With auto-login off (as in the prod profile), the credential-free endpoint must not exist. */
@SpringBootTest(properties = {
        "test.database=devoff",
        "app.seed-samples=false",
        "app.dev-auto-login=false",
        "app.storage.dir=build/test-uploads"
})
@AutoConfigureMockMvc
class DevLoginDisabledTest {

    @Autowired
    MockMvc mvc;

    @Test
    void devLoginIsNotFound() throws Exception {
        mvc.perform(post("/api/auth/dev-login")).andExpect(status().isNotFound());
    }
}
