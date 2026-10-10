package app.lector.curator;

import app.lector.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class CuratorAccess implements HandlerInterceptor {

    public static final String HEADER = "X-Curator-Token";

    private final byte[] token;

    public CuratorAccess(@Value("${app.curator-token:}") String token) {
        this.token = token.strip().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        require(request.getHeader(HEADER));
        return true;
    }

    void require(String presented) {
        if (token.length == 0) {
            throw ApiException.notFound("Endpoint");
        }
        if (presented == null || !MessageDigest.isEqual(token, presented.strip().getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Curator token rejected");
        }
    }
}
