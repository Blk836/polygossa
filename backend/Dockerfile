FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
COPY backend/build.gradle.kts ./backend/
RUN sed -i 's/\r$//' gradlew
RUN ./gradlew --no-daemon :backend:dependencies > /dev/null
COPY backend/src ./backend/src
RUN ./gradlew --no-daemon :backend:bootJar

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system lector && mkdir -p /data/uploads && chown lector /data/uploads
USER lector
COPY --from=build /src/backend/build/libs/backend-*.jar app.jar
ENV SPRING_PROFILES_ACTIVE=prod STORAGE_DIR=/data/uploads
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
