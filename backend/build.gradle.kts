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
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-cache")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-restclient")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    runtimeOnly("org.flywaydb:flyway-database-postgresql")
    implementation(platform("software.amazon.awssdk:bom:2.55.12"))
    implementation("software.amazon.awssdk:s3") {
        exclude(group = "software.amazon.awssdk", module = "netty-nio-client")
    }
    implementation("software.amazon.awssdk:translate") {
        exclude(group = "software.amazon.awssdk", module = "netty-nio-client")
    }

    implementation("com.stripe:stripe-java:34.0.0")

    implementation("io.jsonwebtoken:jjwt-api:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.13.0")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.13.0")

    implementation("org.jsoup:jsoup:1.23.2")
    implementation("org.apache.pdfbox:pdfbox:3.0.5")
    implementation("org.xerial:sqlite-jdbc:3.53.4.0")

    runtimeOnly("org.postgresql:postgresql")
    developmentOnly("org.springframework.boot:spring-boot-docker-compose")

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform { excludeTags("live") }
    maxParallelForks = (findProperty("test.forks") as String?)?.toInt()
        ?: (Runtime.getRuntime().availableProcessors() - 2).coerceIn(1, 4)
    jvmArgs("-XX:TieredStopAtLevel=1", "-XX:+UseSerialGC")
}

val liveTest by tasks.registering(Test::class) {
    description = "Checks the real external services (needs AWS credentials); never part of the ordinary suites."
    group = "verification"
    testClassesDirs = sourceSets.test.get().output.classesDirs
    classpath = sourceSets.test.get().runtimeClasspath
    useJUnitPlatform { includeTags("live") }
    outputs.upToDateWhen { false }
}

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

fun changedMainClasses(since: String): List<String> {
    fun git(vararg args: String) = providers.exec { commandLine("git", *args); workingDir = projectDir }
        .standardOutput.asText.get().lines()
    val files = git("diff", "--name-only", since, "--", "src/main/java") +
        git("ls-files", "--others", "--exclude-standard", "--", "src/main/java")
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
