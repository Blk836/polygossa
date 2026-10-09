package app.lector.config;

import app.lector.dashboard.StatsPeriod;
import app.lector.text.Category;
import app.lector.text.MediaKind;
import app.lector.token.Language;
import app.lector.vocab.EntryKind;
import app.lector.vocab.WordStatus;
import java.util.Locale;
import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(String.class, Language.class, Language::parse);
        registry.addConverter(String.class, WordStatus.class, WordStatus::parse);
        registry.addConverter(String.class, EntryKind.class, s -> EntryKind.valueOf(s.trim().toUpperCase(Locale.ROOT)));
        registry.addConverter(String.class, MediaKind.class, MediaKind::parse);
        registry.addConverter(String.class, Category.class, Category::parse);
        registry.addConverter(String.class, StatsPeriod.class, StatsPeriod::parse);
    }
}
