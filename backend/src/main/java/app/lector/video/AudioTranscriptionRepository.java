package app.lector.video;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AudioTranscriptionRepository extends JpaRepository<AudioTranscription, Long> {

    @Query("select coalesce(sum(t.audioSeconds), 0) from AudioTranscription t")
    long totalAudioSeconds();
}
