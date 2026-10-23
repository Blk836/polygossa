package app.lector.video;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "audio_transcriptions")
public class AudioTranscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String videoId;

    @Column(nullable = false)
    private long audioSeconds;

    @Column(nullable = false)
    private Instant at;

    protected AudioTranscription() {}

    public AudioTranscription(String videoId, long audioSeconds, Instant at) {
        this.videoId = videoId;
        this.audioSeconds = audioSeconds;
        this.at = at;
    }

    public long getAudioSeconds() {
        return audioSeconds;
    }
}
