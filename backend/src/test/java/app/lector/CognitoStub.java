package app.lector;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.function.Consumer;

public final class CognitoStub implements AutoCloseable {

    public static final String CLIENT_ID = "test-client";

    private final HttpServer server;
    private final RSAKey key;
    private final RSAKey stranger;

    public CognitoStub() throws IOException, JOSEException {
        key = new RSAKeyGenerator(2048).keyID("pool-key").generate();
        stranger = new RSAKeyGenerator(2048).keyID("pool-key").generate();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        byte[] jwks = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
        server.createContext("/pool/.well-known/jwks.json", exchange -> {
            try (exchange; OutputStream out = exchange.getResponseBody()) {
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, jwks.length);
                out.write(jwks);
            }
        });
        server.start();
    }

    public String issuer() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/pool";
    }

    public static String newSub() {
        return UUID.randomUUID().toString();
    }

    public String access(String sub, Consumer<JWTClaimsSet.Builder> change) {
        JWTClaimsSet.Builder claims = base(sub).claim("token_use", "access").claim("client_id", CLIENT_ID)
                .claim("scope", "openid email").claim("username", sub);
        change.accept(claims);
        return sign(claims.build(), key);
    }

    public String access(String sub) {
        return access(sub, c -> {});
    }

    public String id(String sub, String email, Consumer<JWTClaimsSet.Builder> change) {
        JWTClaimsSet.Builder claims = base(sub).claim("token_use", "id").audience(CLIENT_ID).claim("email", email)
                .claim("email_verified", true);
        change.accept(claims);
        return sign(claims.build(), key);
    }

    public String id(String sub, String email) {
        return id(sub, email, c -> {});
    }

    public String forged(String sub) {
        return sign(base(sub).claim("token_use", "access").claim("client_id", CLIENT_ID).build(), stranger);
    }

    private JWTClaimsSet.Builder base(String sub) {
        Instant now = Instant.now();
        return new JWTClaimsSet.Builder().issuer(issuer()).subject(sub).issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(3600))).jwtID(UUID.randomUUID().toString());
    }

    private static String sign(JWTClaimsSet claims, RSAKey with) {
        try {
            SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(with.getKeyID()).build(),
                    claims);
            jwt.sign(new RSASSASigner(with));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
