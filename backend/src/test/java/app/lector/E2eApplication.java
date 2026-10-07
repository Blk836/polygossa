package app.lector;

import org.springframework.boot.SpringApplication;

/**
 * The backend the browser tests run against: ./gradlew :backend:bootTestRun (frontend/playwright.config.ts starts
 * it). It is the real app on the test classpath, so {@link TestDatabases} gives it a PostgreSQL container of its own,
 * with the "e2e" profile (application-e2e.properties) putting back the development settings the backend tests
 * change.
 */
public final class E2eApplication {

    private E2eApplication() {
    }

    public static void main(String[] args) {
        SpringApplication.from(LectorApplication::main).withAdditionalProfiles("e2e").run(args);
    }
}
