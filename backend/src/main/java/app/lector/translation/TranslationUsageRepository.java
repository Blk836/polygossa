package app.lector.translation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface TranslationUsageRepository extends JpaRepository<TranslationUsage, String> {

    @Modifying
    @Transactional
    @Query(value = """
            insert into translation_usage (month, characters)
            select :month, :characters where :characters <= :cap
            on conflict (month) do update set characters = translation_usage.characters + excluded.characters
            where translation_usage.characters + excluded.characters <= :cap
            """, nativeQuery = true)
    int add(@Param("month") String month, @Param("characters") long characters, @Param("cap") long cap);
}
