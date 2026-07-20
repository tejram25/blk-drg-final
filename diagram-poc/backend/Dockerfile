# Multi-stage build for the Spring Boot backend, so free hosts that build from a
# Dockerfile (e.g. Render) can run the Java app without a Java buildpack.

# ---- build ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

# ---- run ----
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
# The platform injects $PORT; application.properties binds server.port=${PORT:8080},
# so no extra flags are needed. 8080 is just the local default.
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
