package app.lector;

import org.springframework.boot.SpringApplication;

public final class E2eApplication {

    private E2eApplication() {
    }

    public static void main(String[] args) {
        SpringApplication.from(LectorApplication::main).withAdditionalProfiles("e2e").run(args);
    }
}
