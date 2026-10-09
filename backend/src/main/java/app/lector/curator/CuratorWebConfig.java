package app.lector.curator;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CuratorWebConfig implements WebMvcConfigurer {

    private final CuratorAccess access;

    public CuratorWebConfig(CuratorAccess access) {
        this.access = access;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(access).addPathPatterns("/api/curator/**");
    }
}
