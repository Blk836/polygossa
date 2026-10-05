package app.lector;

import org.springframework.boot.test.context.SpringBootTest;

/** The brand scenarios with a configured name, as a future rename would set BRAND_NAME. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:custombrand;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
        "app.seed-samples=true",
        "app.seed-videos-on-startup=false",
        "app.brand.name=Acme Read"
})
class CustomBrandTest extends BrandScenarios {

    @Override
    String brand() {
        return "Acme Read";
    }
}
