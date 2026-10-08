package app.lector.config;

import app.lector.user.AuthUser;
import app.lector.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates requests carrying {@code Authorization: Bearer <jwt>}: a Cognito access token of an identity linked
 * to an account, or, when local accounts are on (never in production), one of the app's own tokens.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService ownTokens;
    private final CognitoTokens cognito;
    private final UserRepository users;
    private final boolean localAccounts;

    public JwtAuthFilter(JwtService ownTokens, CognitoTokens cognito, UserRepository users, boolean localAccounts) {
        this.ownTokens = ownTokens;
        this.cognito = cognito;
        this.users = users;
        this.localAccounts = localAccounts;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            authenticate(header.substring(7)).ifPresent(user -> {
                var auth = new UsernamePasswordAuthenticationToken(
                        user, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(request, response);
    }

    private Optional<AuthUser> authenticate(String token) {
        Optional<AuthUser> fromCognito = cognito.access(token)
                .flatMap(identity -> users.findByCognitoSub(identity.sub()))
                .map(user -> new AuthUser(user.getId(), user.getEmail()));
        if (fromCognito.isPresent() || !localAccounts) {
            return fromCognito;
        }
        return ownTokens.verify(token);
    }
}
