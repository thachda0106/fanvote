# syntax=docker/dockerfile:1
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
ARG OTEL_AGENT_VERSION=2.33.1
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app \
    && wget -q -O /app/otel-agent.jar \
       "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar"
COPY --from=build /app/target/commerce-0.1.0.jar app.jar
USER app
EXPOSE 8081
ENTRYPOINT ["java", "-javaagent:/app/otel-agent.jar", "-Duser.timezone=UTC", "-jar", "app.jar"]
