package app.lector.text;

import app.lector.common.ApiException;
import app.lector.storage.StorageService;
import app.lector.token.Token;
import app.lector.user.PlanService;
import app.lector.user.User;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

@Service
public class TextAudioService {

    private final TextService texts;
    private final PlanService plans;
    private final StorageService storage;
    private final ObjectMapper json;

    public TextAudioService(TextService texts, PlanService plans, StorageService storage, ObjectMapper json) {
        this.texts = texts;
        this.plans = plans;
        this.storage = storage;
        this.json = json;
    }

    @Transactional
    public void attachFile(User user, Long id, MultipartFile file) {
        plans.require(user, PlanService.Feature.AUDIO_SYNC);
        Text text = loadAudioTarget(user, id);
        String stored = storage.saveAudio(file);
        clear(text);
        text.setAudioFile(stored);
        text.setAudioContentType(file.getContentType());
    }

    @Transactional
    public void attachUrl(User user, Long id, String url) {
        plans.require(user, PlanService.Feature.AUDIO_SYNC);
        Text text = loadAudioTarget(user, id);
        if (url == null || !url.matches("(?i)https?://\\S+")) {
            throw ApiException.badRequest("Audio link must be an http(s) URL");
        }
        clear(text);
        text.setAudioUrl(url.trim());
    }

    @Transactional
    public void remove(User user, Long id) {
        clear(texts.loadOwned(user, id));
    }

    @Transactional
    public List<AudioAligner.WordTiming> alignAuto(User user, Long id, long durationMs) {
        Text text = loadSyncable(user, id);
        List<Token> tokens = texts.tokens(text);
        List<SubtitleParser.Cue> cues = texts.cues(text);
        List<AudioAligner.WordTiming> timings = cues.isEmpty()
                ? AudioAligner.estimate(tokens, durationMs)
                : AudioAligner.fromCues(tokens, cues);
        text.setTimingsJson(json.writeValueAsString(timings));
        return timings;
    }

    @Transactional
    public List<AudioAligner.WordTiming> alignFromMarks(User user, Long id, List<AudioAligner.SentenceMark> marks,
                                                         long durationMs) {
        Text text = loadSyncable(user, id);
        if (marks == null || marks.isEmpty()) {
            throw ApiException.badRequest("Tap at least one sentence start");
        }
        List<AudioAligner.WordTiming> timings = AudioAligner.fromSentenceMarks(texts.tokens(text), marks, durationMs);
        text.setTimingsJson(json.writeValueAsString(timings));
        return timings;
    }

    private Text loadAudioTarget(User user, Long id) {
        Text text = texts.loadOwned(user, id);
        if (text.isVideo()) {
            throw ApiException.badRequest("Videos use their own soundtrack; audio can't be attached");
        }
        return text;
    }

    private Text loadSyncable(User user, Long id) {
        plans.require(user, PlanService.Feature.AUDIO_SYNC);
        Text text = texts.loadOwned(user, id);
        if (!text.hasAudio()) {
            throw ApiException.badRequest("Attach audio to this text first");
        }
        return text;
    }

    private void clear(Text text) {
        storage.delete(text.getAudioFile());
        text.setAudioFile(null);
        text.setAudioContentType(null);
        text.setAudioUrl(null);
        text.setTimingsJson(null);
    }
}
