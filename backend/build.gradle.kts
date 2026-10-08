plugins {
    java
    checkstyle
    id("info.solidsoft.pitest") version "1.19.0"
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "app.lector"
version = "0.1.0"

repositories {
    mavenCentral()
}

tasks.withType<JavaCompile> {
    options.release = 21
    options.compilerArgs.add("-parameters")
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-security")
    // Checks Cognito's login tokens against the user pool's published keys (app.login.cognito-issuer).
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-restclient")
    // Versioned schema changes (src/main/resources/db/migration); Hibernate only validates the schema.
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    runtimeOnly("org.flywaydb:flyway-database-postgresql")
    // Uploads in S3 in production (app.storage.s3-bucket); only the synchronous client, so Netty is left out.
    implementation(platform("software.amazon.awssdk:bom:2.55.12"))
    implementation("software.amazon.awssdk:s3") {
        exclude(group = "software.amazon.awssdk", module = "netty-nio-client")
    }

    implementation("io.jsonwebtoken:jjwt-api:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.13.0")

    implementation("org.jsoup:jsoup:1.23.2")
    // Reading PDF imports (books); EPUB is a zip of XHTML, read with the JDK and jsoup.
    implementation("org.apache.pdfbox:pdfbox:3.0.5")
    implementation("org.xerial:sqlite-jdbc:3.53.4.0")

    runtimeOnly("org.postgresql:postgresql")
    // bootRun starts the dev database from compose.dev.yml (never packaged into the jar).
    developmentOnly("org.springframework.boot:spring-boot-docker-compose")

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// The suite is CPU-bound (booting apps and JIT-compiling them), so test classes run in several JVMs at once, each
// with the quick C1-only JIT and a single-threaded GC so they don't fight over cores: measured on a 6-core machine,
// 132 s serially with default flags, 73 s with 4 JVMs and these flags. Each JVM holds up to 512 MB of cached apps,
// so it never uses more than 4. -Ptest.forks=N overrides the count.
tasks.test {
    useJUnitPlatform()
    maxParallelForks = (findProperty("test.forks") as String?)?.toInt()
        ?: (Runtime.getRuntime().availableProcessors() - 2).coerceIn(1, 4)
    jvmArgs("-XX:TieredStopAtLevel=1", "-XX:+UseSerialGC")
}

// The browser tests' backend (frontend/playwright.config.ts): the app on the test classpath, with a PostgreSQL
// container of its own (see E2eApplication).
// Local runs (QA) sign in through the QA user pool (stack PolygossaQa's outputs; cognito-login.feature). Only bootRun:
// tests and the browser tests' backend (bootTestRun) keep the app's own accounts. COGNITO_ISSUER= (empty) turns it off.
tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    environment("COGNITO_ISSUER", System.getenv("COGNITO_ISSUER")
        ?: "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_MY7u80TAo")
    environment("COGNITO_CLIENT_ID", System.getenv("COGNITO_CLIENT_ID") ?: "5d0r0dpumsq3nihfq59piv9kd5")
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootTestRun") {
    mainClass = "app.lector.E2eApplication"
}

checkstyle {
    toolVersion = "14.3.0"
    configFile = rootProject.file("config/checkstyle/checkstyle.xml")
    isIgnoreFailures = false
    maxWarnings = 0
}

// Mutation testing: ./gradlew :backend:pitest (report in build/reports/pitest) mutates every main class, which takes
// a while. To test just a change, -Ppitest.since=<commit> mutates only the main classes changed since that commit
// (committed, uncommitted or new), e.g. the commit before a task's first one; -Ppitest.targets=app.lector.text.*
// names classes or packages directly. PIT still runs only the tests that cover the mutated classes.
// -Ppitest.tests=app.lector.recommend.WeightLearnerTest,… limits the tests too (PIT measures coverage with every
// test first, which alone takes minutes), e.g. to check pure classes against their unit tests.
// (PIT's incremental history moved to a paid plugin in 1.30, so a re-run can't reuse earlier results.)
fun changedMainClasses(since: String): List<String> {
    fun git(vararg args: String) = providers.exec { commandLine("git", *args); workingDir = projectDir }
        .standardOutput.asText.get().lines()
    val files = git("diff", "--name-only", since, "--", "src/main/java") +
        git("ls-files", "--others", "--exclude-standard", "--", "src/main/java")
    // diff names files from the repo root, ls-files from backend/; deleted files have no class left to mutate.
    val classes = files.map { it.trim() }
        .filter { it.endsWith(".java") && (rootProject.file(it).exists() || file(it).exists()) }
        .map { it.substringAfter("src/main/java/").removeSuffix(".java").replace('/', '.') }
        .distinct()
    if (classes.isEmpty()) {
        throw GradleException("No backend main classes changed since $since")
    }
    return classes.flatMap { listOf(it, "$it$*") }
}

pitest {
    pitestVersion = "1.30.0"
    junit5PluginVersion = "1.2.3"
    targetClasses = (findProperty("pitest.targets") as String?)?.split(",")
        ?: (findProperty("pitest.since") as String?)?.let { changedMainClasses(it) }
        ?: listOf("app.lector.*")
    targetTests = (findProperty("pitest.tests") as String?)?.split(",") ?: listOf("app.lector.*")
    excludedClasses = listOf("app.lector.LectorApplication")
    threads = 4
    outputFormats = listOf("HTML", "XML")
    timestampedReports = false
    mutationThreshold = (findProperty("pitest.threshold") as String?)?.toInt() ?: 0
}
