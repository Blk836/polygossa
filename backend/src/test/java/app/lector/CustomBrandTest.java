package app.lector;

import org.springframework.boot.test.context.SpringBootTest;

/** The brand scenarios with a configured name, as a future rename would set BRAND_NAME. */
@SpringBootTest(properties = {
        "test.database=custombrand",
        "app.seed-samples=true",
        "app.brand.name=Acme Read"
})
class CustomBrandTest extends BrandScenarios {

    @Override
    String brand() {
        return "Acme Read";
    }
}
