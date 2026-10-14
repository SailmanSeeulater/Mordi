package com.mordi.backend.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mordi.backend.service.EmailAddresses;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.distributed.serialization.Mapper;
import io.github.bucket4j.redis.jedis.Bucket4jJedis;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;
import redis.clients.jedis.JedisPool;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.SequenceInputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import java.util.function.Supplier;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int CAPACITY = 5;
    private static final Duration REFILL_PERIOD = Duration.ofMinutes(1);

    /**
     * Every request that checks a password or sends an email. Each has its
     * own bucket per address, so guessing passwords does not use up someone's
     * reset requests. The account ones need a signed-in token as well, but a
     * stolen token should not buy unlimited guesses at the password.
     */
    static final Set<String> LIMITED = Set.of(
        "POST /api/auth/register",
        "POST /api/auth/login",
        "POST /api/auth/forgot",
        "POST /api/auth/reset",
        "PUT /api/account/password",
        "DELETE /api/account");

    /**
     * The two where what is being guessed at is one account rather than the
     * server. These get a second bucket keyed on the address in the body, so
     * spreading the guesses over many machines buys nothing.
     */
    static final Set<String> PER_ACCOUNT = Set.of(
        "POST /api/auth/login",
        "POST /api/auth/forgot");

    private final ProxyManager<String> proxyManager;
    private final ObjectMapper json;

    public RateLimitFilter(JedisPool jedisPool, ObjectMapper json) {
        this.proxyManager = Bucket4jJedis.casBasedBuilder(jedisPool)
            .keyMapper(Mapper.STRING)
            .build();
        this.json = json;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {

        String path = path(request);
        String route = request.getMethod().toUpperCase() + " " + path;
        if (!LIMITED.contains(route)) {
            filterChain.doFilter(request, response);
            return;
        }

        // The address as Tomcat worked it out: the proxy's X-Forwarded-For is
        // honoured only when the connection came from the proxy itself (see
        // server.tomcat.remoteip in application.properties), so a client
        // cannot pick its own.
        String clientIp = request.getRemoteAddr();
        HttpServletRequest downstream = request;
        String targetEmail = null;
        if (PER_ACCOUNT.contains(route)) {
            BufferedBodyRequest buffered = new BufferedBodyRequest(request);
            targetEmail = targetEmail(buffered);
            downstream = buffered;
        }

        boolean allowed = resolveBucket(path, "ip:" + clientIp).tryConsume(1)
            && (targetEmail == null || resolveBucket(path, "email:" + targetEmail).tryConsume(1));

        if (allowed) {
            filterChain.doFilter(downstream, response);
        } else {
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"status\":429,\"error\":\"Too many attempts. Please wait a minute and try again.\"}"
            );
        }
    }

    /**
     * The path as the controller will see it: decoded, matrix parameters
     * stripped, no trailing slash. Matching the raw URI let "/api/auth/%6Cogin"
     * and "/api/auth/login/" reach the controller without ever meeting a bucket.
     */
    private static String path(HttpServletRequest request) {
        String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
        while (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return path;
    }

    private BucketProxy resolveBucket(String path, String who) {
        String key = "rate-limit:" + path + ":" + who;
        Supplier<BucketConfiguration> configSupplier = () -> BucketConfiguration.builder()
            .addLimit(limit -> limit.capacity(CAPACITY).refillGreedy(CAPACITY, REFILL_PERIOD))
            .build();
        return proxyManager.getProxy(key, configSupplier);
    }

    /**
     * The "email" field of the JSON body, in the one form addresses are
     * stored in. Null when there is no such field or the body is not JSON:
     * the controller will refuse it anyway, and the address bucket is only
     * ever on top of the one per client.
     */
    private String targetEmail(BufferedBodyRequest request) {
        try {
            JsonNode email = json.readTree(request.prefix()).get("email");
            if (email == null || !email.isTextual() || email.asText().isBlank()) {
                return null;
            }
            return EmailAddresses.normalize(email.asText());
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    /**
     * A request whose body can be read twice: once here, once by the
     * controller. Only the first few kilobytes are kept, which is far more
     * than a sign-in body needs; anything past that streams through to the
     * controller untouched, so a large body costs no memory here.
     */
    private static final class BufferedBodyRequest extends HttpServletRequestWrapper {

        private static final int PREFIX_BYTES = 16 * 1024;

        private final byte[] prefix;
        private final ServletInputStream rest;

        BufferedBodyRequest(HttpServletRequest request) throws IOException {
            super(request);
            this.rest = request.getInputStream();
            this.prefix = rest.readNBytes(PREFIX_BYTES);
        }

        byte[] prefix() {
            return prefix;
        }

        @Override
        public ServletInputStream getInputStream() {
            InputStream in = new SequenceInputStream(new ByteArrayInputStream(prefix), rest);
            return new ServletInputStream() {
                private boolean finished;

                @Override
                public int read() throws IOException {
                    int b = in.read();
                    finished = b < 0;
                    return b;
                }

                @Override
                public int read(byte[] buffer, int off, int len) throws IOException {
                    int n = in.read(buffer, off, len);
                    finished = n < 0;
                    return n;
                }

                @Override
                public boolean isFinished() {
                    return finished;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException("Non-blocking reads are not supported here");
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            Charset charset = encoding == null ? StandardCharsets.UTF_8 : Charset.forName(encoding);
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }
    }
}
