package app.lector.text;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class CategoryTest {

    @Test
    void hasTenCategoriesPlusOtherWithLowerCaseCodes() {
        assertThat(Arrays.stream(Category.values()).map(Category::code)).containsExactly(
                "learners", "daily-life", "stories", "news", "culture", "travel", "food", "science", "history",
                "entertainment", "other");
    }

    @Test
    void parsesCodesLeniently() {
        assertThat(Category.parse("food")).isEqualTo(Category.FOOD);
        assertThat(Category.parse(" Daily-Life ")).isEqualTo(Category.DAILY_LIFE);
        assertThat(Category.parse("OTHER")).isEqualTo(Category.OTHER);
    }

    @Test
    void rejectsUnknownCodes() {
        assertThatThrownBy(() -> Category.parse("sports")).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("learners");
        assertThatThrownBy(() -> Category.parse("")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Category.parse(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Category.parse("daily_life")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void mapsYouTubeCategories() {
        assertThat(Category.fromYouTube("Education")).isEqualTo(Category.LEARNERS);
        assertThat(Category.fromYouTube("People & Blogs")).isEqualTo(Category.DAILY_LIFE);
        assertThat(Category.fromYouTube("Howto & Style")).isEqualTo(Category.DAILY_LIFE);
        assertThat(Category.fromYouTube("Pets & Animals")).isEqualTo(Category.DAILY_LIFE);
        assertThat(Category.fromYouTube("Travel & Events")).isEqualTo(Category.TRAVEL);
        assertThat(Category.fromYouTube("News & Politics")).isEqualTo(Category.NEWS);
        assertThat(Category.fromYouTube("Nonprofits & Activism")).isEqualTo(Category.NEWS);
        assertThat(Category.fromYouTube("Science & Technology")).isEqualTo(Category.SCIENCE);
        assertThat(Category.fromYouTube("Film & Animation")).isEqualTo(Category.ENTERTAINMENT);
        assertThat(Category.fromYouTube("Music")).isEqualTo(Category.ENTERTAINMENT);
        assertThat(Category.fromYouTube("Comedy")).isEqualTo(Category.ENTERTAINMENT);
        assertThat(Category.fromYouTube("Entertainment")).isEqualTo(Category.ENTERTAINMENT);
        assertThat(Category.fromYouTube("Gaming")).isEqualTo(Category.ENTERTAINMENT);
        assertThat(Category.fromYouTube("Sports")).isEqualTo(Category.ENTERTAINMENT);
    }

    @Test
    void unknownOrMissingYouTubeCategoriesAreOther() {
        assertThat(Category.fromYouTube("Autos & Vehicles")).isEqualTo(Category.OTHER);
        assertThat(Category.fromYouTube("education")).isEqualTo(Category.OTHER);
        assertThat(Category.fromYouTube("")).isEqualTo(Category.OTHER);
        assertThat(Category.fromYouTube(null)).isEqualTo(Category.OTHER);
    }
}
