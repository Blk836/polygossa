package app.lector.config;

import app.lector.common.RateLimiter;
import app.lector.user.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerInterceptor;

class RateLimitInterceptor implements HandlerInterceptor {

    static final String[] LOOKUP_PATHS = {"/api/dictionary/**"};
    static final String[] IMPORT_PATHS = {"/api/texts", "/api/texts/import-*", "/api/word-imports/lingq",
            "/api/word-imports/readlang"};

    private final RateLimiter limiter;

    RateLimitInterceptor(RateLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthUser user)) {
            return true;
        }
        if (request.getRequestURI().startsWith("/api/dictionary")) {
            limiter.check(RateLimiter.Bucket.LOOKUPS, user.id());
        } else if (HttpMethod.POST.matches(request.getMethod())) {
            limiter.check(RateLimiter.Bucket.IMPORTS, user.id());
        }
        return true;
    }
}
