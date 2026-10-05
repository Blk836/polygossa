package app.lector;

import org.springframework.boot.test.context.SpringBootTest;

/** The brand scenarios with BRAND_NAME unset: Polygossa. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:branding;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=true",
        "app.seed-videos-on-startup=false"
})
class DefaultBrandTest extends BrandScenarios {

    @Override
    String brand() {
        return "Polygossa";
    }
}
