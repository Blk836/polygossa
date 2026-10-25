package app.lector;

import org.springframework.boot.SpringApplication;

public final class E2eApplication {

    private E2eApplication() {
    }

    public static void main(String[] args) {
        SpringApplication.from(LectorApplication::main).with(E2eNames.class, E2eNotWords.class).withAdditionalProfiles("e2e").run(args);
    }
}
