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
# Explicit memory limits. The VM has 1 GB for this app and three others, and
# left to itself the JVM sizes the heap from whatever memory it sees and lets
# metaspace, code cache and direct buffers grow without bound. Every pool is
# capped here so the process has a known ceiling well inside the container's
# mem_limit (docker-compose.yml); the PR that added this has the measurements.
#  -Xmx256m          heap. Idle use is ~80 MB; the headroom is for a calendar
#                    sync round (ICS bodies up to 5 MB each) and data exports.
#  -Xss512k          per-thread stack, half the default; Tomcat's pool is
#                    capped too (server.tomcat.threads.max).
#  MaxMetaspaceSize  class metadata. Spring, Hibernate and friends load
#                    ~110 MB of it; the cap stops a class leak growing forever.
#  ReservedCodeCacheSize, MaxDirectMemorySize
#                    JIT-compiled code and NIO buffers, otherwise sized from
#                    the defaults (240 MB) and the heap.
#  UseSerialGC       one GC thread, smallest footprint; pauses on a heap this
#                    size are a few milliseconds.
#  TieredStopAtLevel=1
#                    C1 compiler only: faster startup on the VM's slow CPU and
#                    a smaller code cache, at a cost in peak throughput this
#                    app never needs.
#  ExitOnOutOfMemoryError
#                    if a cap is hit anyway, exit and let Docker restart a
#                    clean JVM instead of limping on half-broken.
# JAVA_TOOL_OPTIONS rather than flags in ENTRYPOINT, so a different set can be
# tried from docker-compose.yml without rebuilding the image.
ENV JAVA_TOOL_OPTIONS="-Xmx256m -Xss512k -XX:MaxMetaspaceSize=160m -XX:ReservedCodeCacheSize=64m -XX:MaxDirectMemorySize=64m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "app.jar"]
