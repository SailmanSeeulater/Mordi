# Dependencies resolve in their own layer, before the source is copied.
# Docker throws away every layer after the first one whose inputs changed, so
# with the source copied in first, every deploy re-downloaded the whole
# dependency tree — minutes of it, on every push, for a one-line change.
# Here only a change to pom.xml costs that download.
# 21 is the LTS the pom targets (java.version); the JRE below must match it.
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY .mvn ./.mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src ./src
# Not -o: go-offline misses a plugin dependency now and then, and the build
# should fetch it rather than fail.
RUN ./mvnw -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
# The app runs as its own user, not root: a hole in it then gives a shell
# that owns nothing writable. The jar stays root's and world-readable, which
# is all the JVM needs.
RUN addgroup -S mordi && adduser -S mordi -G mordi
COPY --from=build /app/target/*.jar app.jar
RUN chmod 444 app.jar
USER mordi
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
