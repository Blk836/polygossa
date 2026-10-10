package app.lector.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.login")
public record LoginProperties(
        @DefaultValue("true") boolean localAccounts,
        @DefaultValue("") String cognitoIssuer,
        @DefaultValue("") String cognitoClientId) {

    public boolean cognito() {
        return !cognitoIssuer.isBlank() && !cognitoClientId.isBlank();
    }
}
