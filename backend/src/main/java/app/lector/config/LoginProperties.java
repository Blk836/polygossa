package app.lector.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * How people sign in (cognito-login.feature). {@code cognitoIssuer} (the user pool's address) and
 * {@code cognitoClientId} switch on login through Cognito; blank leaves it off. {@code localAccounts} keeps the app's
 * own email-and-password accounts and login tokens: on for local runs and tests, off in production.
 */
@ConfigurationProperties(prefix = "app.login")
public record LoginProperties(
        @DefaultValue("true") boolean localAccounts,
        @DefaultValue("") String cognitoIssuer,
        @DefaultValue("") String cognitoClientId) {

    public boolean cognito() {
        return !cognitoIssuer.isBlank() && !cognitoClientId.isBlank();
    }
}
