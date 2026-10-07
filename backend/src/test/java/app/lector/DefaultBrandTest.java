package app.lector;

import org.springframework.boot.test.context.SpringBootTest;

/** The brand scenarios with BRAND_NAME unset: Polygossa. */
@SpringBootTest(properties = {
        "test.database=branding",
        "app.seed-samples=true"
})
class DefaultBrandTest extends BrandScenarios {

    @Override
    String brand() {
        return "Polygossa";
    }
}
