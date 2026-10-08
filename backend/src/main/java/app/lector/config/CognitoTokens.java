package app.lector.config;

import java.util.List;
import java.util.Optional;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Checks tokens from our Cognito user pool: signed with a key the pool publishes, from its issuer, unexpired, and
 * meant for our app client. Access tokens sign API requests; an ID token (which carries the email) is checked only
 * when a session starts.
 */
@Component
public class CognitoTokens {

    /** A checked Cognito identity: its stable id ("sub") and, from an ID token, its email. */
    public record Identity(String sub, String email, boolean emailVerified) {}

    private final NimbusJwtDecoder access;
    private final NimbusJwtDecoder id;

    public CognitoTokens(LoginProperties props) {
        if (!props.cognito()) {
            access = null;
            id = null;
            return;
        }
        String issuer = props.cognitoIssuer();
        String client = props.cognitoClientId();
        access = decoder(issuer, jwt -> "access".equals(jwt.getClaimAsString("token_use"))
                && client.equals(jwt.getClaimAsString("client_id")));
        id = decoder(issuer, jwt -> "id".equals(jwt.getClaimAsString("token_use"))
                && jwt.getAudience() != null && jwt.getAudience().contains(client));
    }

    public boolean enabled() {
        return access != null;
    }

    /** The identity an access token speaks for, or empty when it isn't a valid one of ours. */
    public Optional<Identity> access(String token) {
        return decode(access, token).map(jwt -> new Identity(jwt.getSubject(), null, false));
    }

    /** The identity and email in an ID token, or empty when it isn't a valid one of ours. */
    public Optional<Identity> id(String token) {
        return decode(id, token).map(jwt -> new Identity(jwt.getSubject(), jwt.getClaimAsString("email"),
                Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))));
    }

    private static Optional<Jwt> decode(NimbusJwtDecoder decoder, String token) {
        if (decoder == null || token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(decoder.decode(token));
        } catch (JwtException e) {
            return Optional.empty();
        }
    }

    private static NimbusJwtDecoder decoder(String issuer, java.util.function.Predicate<Jwt> ours) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(issuer + "/.well-known/jwks.json")
                .jwsAlgorithm(SignatureAlgorithm.RS256).build();
        OAuth2TokenValidator<Jwt> kind = jwt -> ours.test(jwt)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Not a token for this app", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                List.of(JwtValidators.createDefaultWithIssuer(issuer), kind)));
        return decoder;
    }
}
