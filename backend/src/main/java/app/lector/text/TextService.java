package app.lector.text;

import app.lector.ai.WritingSubmissionRepository;
import app.lector.classroom.AssignmentRepository;
import app.lector.common.ApiException;
import app.lector.library.TextReactionRepository;
import app.lector.playlist.PlaylistItemRepository;
import app.lector.progress.ReadingProgressRepository;
import app.lector.session.ReadingSessionRepository;
import app.lector.storage.StorageService;
import app.lector.text.TextDtos.AudioDto;
import app.lector.text.TextDtos.KnownStats;
import app.lector.text.TextDtos.OwnerDto;
import app.lector.text.TextDtos.PhraseStatus;
import app.lector.text.TextDtos.TextDetail;
import app.lector.text.TextDtos.TextSummary;
import app.lector.token.Language;
import app.lector.token.Token;
import app.lector.token.TokenizationService;
import app.lector.user.PlanService;
import app.lector.user.User;
import app.lector.vocab.EntryKind;
import app.lector.vocab.VocabularyRepository;
import app.lector.vocab.WordStatus;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
public class TextService {

    public static final int MAX_CONTENT_CHARS = 100_000;

    private final TextRepository texts;
    private final VocabularyRepository vocabulary;
    private final ReadingSessionRepository sessions;
    private final ReadingProgressRepository progress;
    private final TextReactionRepository reactions;
    private final PlaylistItemRepository playlistItems;
    private final AssignmentRepository assignments;
    private final WritingSubmissionRepository writings;
    private final TokenizationService tokenizer;
    private final PlanService plans;
    private final StorageService storage;
    private final ObjectMapper json;
    private final UniqueWordsCache uniqueWords;
    private final ApplicationEventPublisher events;

    public TextService(TextRepository texts, VocabularyRepository vocabulary,
                       ReadingSessionRepository sessions, ReadingProgressRepository progress,
                       TextReactionRepository reactions, PlaylistItemRepository playlistItems,
                       AssignmentRepository assignments,
                       WritingSubmissionRepository writings, TokenizationService tokenizer, PlanService plans,
                       StorageService storage, ObjectMapper json,
                       UniqueWordsCache uniqueWords, ApplicationEventPublisher events) {
        this.texts = texts;
        this.vocabulary = vocabulary;
        this.sessions = sessions;
        this.progress = progress;
        this.reactions = reactions;
        this.playlistItems = playlistItems;
        this.assignments = assignments;
        this.writings = writings;
        this.tokenizer = tokenizer;
        this.plans = plans;
        this.storage = storage;
        this.json = json;
        this.uniqueWords = uniqueWords;
        this.events = events;
    }

    @Transactional
    public Text create(User owner, String title, Language language, String content, String sourceUrl,
                       boolean isPublic, List<SubtitleParser.Cue> cues) {
        plans.checkCanImportText(owner);
        return createUnchecked(owner, title, language, content, sourceUrl, isPublic, cues);
    }

    @Transactional
    public Text createUnchecked(User owner, String title, Language language, String content, String sourceUrl,
                                boolean isPublic, List<SubtitleParser.Cue> cues) {
        String clean = content == null ? "" : content.strip();
        if (clean.isEmpty()) {
            throw ApiException.badRequest("The text is empty");
        }
        if (clean.length() > MAX_CONTENT_CHARS) {
            throw ApiException.badRequest("Texts are limited to " + MAX_CONTENT_CHARS + " characters; split it into parts");
        }
        if (title == null || title.isBlank()) {
            throw ApiException.badRequest("A title is required");
        }
        List<Token> tokens = tokenizer.tokenize(language, clean);
        DifficultyEstimator.Estimate estimate = DifficultyEstimator.estimate(language, tokens);
        String trimmedTitle = title.strip();
        Text text = new Text(owner, trimmedTitle.length() > 250 ? trimmedTitle.substring(0, 250) : trimmedTitle,
                language, clean);
        text.setTokensJson(json.writeValueAsString(tokens));
        text.setWordsJson(KnownWords.wordsJson(tokens, json));
        text.setSourceUrl(sourceUrl);
        text.setPublic(isPublic);
        text.setCefrLevel(estimate.level());
        text.setWordCount(estimate.wordCount());
        text.setUniqueWordCount(estimate.uniqueWordCount());
        if (cues != null && !cues.isEmpty()) {
            text.setCuesJson(json.writeValueAsString(cues));
        }
        return texts.save(text);
    }

    public List<Token> replaceTranscript(Text text, String content, List<SubtitleParser.Cue> cues) {
        List<Token> tokens = tokenizer.tokenize(text.getLanguage(), content);
        DifficultyEstimator.Estimate estimate = DifficultyEstimator.estimate(text.getLanguage(), tokens);
        text.setContent(content);
        text.setTokensJson(json.writeValueAsString(tokens));
        text.setWordsJson(KnownWords.wordsJson(tokens, json));
        text.setCefrLevel(estimate.level());
        text.setWordCount(estimate.wordCount());
        text.setUniqueWordCount(estimate.uniqueWordCount());
        text.setCuesJson(json.writeValueAsString(cues));
        return tokens;
    }

    public Text importSubtitles(User owner, MultipartFile file, String title, Language language, boolean isPublic) {
        String raw;
        try {
            raw = new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (java.io.IOException e) {
            throw ApiException.badRequest("Could not read the uploaded file");
        }
        SubtitleParser.Parsed parsed = SubtitleParser.parse(raw);
        String name = title != null && !title.isBlank() ? title
                : (file.getOriginalFilename() == null ? "Subtitles" : file.getOriginalFilename().replaceAll("\\.[^.]+$", ""));
        return create(owner, name, language, parsed.content(), null, isPublic, parsed.cues());
    }

    public Text load(Long id) {
        return texts.findById(id).orElseThrow(() -> ApiException.notFound("Text"));
    }

    public Text loadReadable(User user, Long id) {
        Text text = load(id);
        if (!canRead(user, text)) {
            throw ApiException.notFound("Text");
        }
        return text;
    }

    public Text loadOwned(User user, Long id) {
        Text text = load(id);
        if (!text.getOwner().getId().equals(user.getId())) {
            throw canRead(user, text) ? ApiException.forbidden("Only the owner can change this text") : ApiException.notFound("Text");
        }
        return text;
    }

    public boolean canRead(User user, Text text) {
        return text.getOwner().getId().equals(user.getId()) || text.isPublic()
                || assignments.isAssignedTo(text.getId(), user.getId());
    }

    public List<Token> tokens(Text text) {
        return json.readValue(text.getTokensJson(), new TypeReference<List<Token>>() {});
    }

    public List<SubtitleParser.Cue> cues(Text text) {
        if (text.getCuesJson() == null) {
            return List.of();
        }
        return json.readValue(text.getCuesJson(), new TypeReference<List<SubtitleParser.Cue>>() {});
    }

    @Transactional(readOnly = true)
    public TextDetail detail(User user, Long id) {
        Text text = loadReadable(user, id);
        List<Token> tokens = tokens(text);
        Map<String, WordStatus> all = new HashMap<>();
        List<PhraseStatus> phrases = new ArrayList<>();
        for (var ts : vocabulary.findTermStatuses(user.getId(), text.getLanguage())) {
            if (ts.getKind() == EntryKind.PHRASE) {
                phrases.add(new PhraseStatus(ts.getTerm(), ts.getStatus()));
            } else {
                all.put(ts.getTerm(), ts.getStatus());
            }
        }
        Map<String, WordStatus> statuses = new LinkedHashMap<>();
        for (Token t : tokens) {
            if (t.word() && all.containsKey(t.normalized())) {
                statuses.put(t.normalized(), all.get(t.normalized()));
            }
        }
        String lowerContent = text.getContent().toLowerCase();
        phrases.removeIf(p -> !lowerContent.contains(p.term()));
        return new TextDetail(summarize(user, text, stats(tokens, all), null, null, null), tokens, statuses, phrases,
                audio(text), VideoViews.dto(text, timings(text), () -> AudioAligner.fromCues(tokens, cues(text))),
                text.getLanguage().speechLocale());
    }

    @Transactional(readOnly = true)
    public List<TextSummary> listMine(User user, MediaKind kind, Language language, Category category) {
        Map<Language, Map<String, WordStatus>> statusCache = new HashMap<>();
        List<TextSummary> out = new ArrayList<>();
        for (Text text : texts.findByOwnerIdOrderByCreatedAtDesc(user.getId())) {
            if (!LibraryFilter.matches(text, kind, language, category)) {
                continue;
            }
            out.add(summarize(user, text, statsFor(user, text, statusCache), null, null, null));
        }
        return out;
    }

    public TextSummary statsSummary(User user, Text text) {
        return summarize(user, text, statsFor(user, text, new HashMap<>()), null, null, null);
    }

    public KnownStats statsFor(User user, Text text, Map<Language, Map<String, WordStatus>> cache) {
        Map<String, WordStatus> statuses = cache.computeIfAbsent(text.getLanguage(), lang -> {
            Map<String, WordStatus> m = new HashMap<>();
            for (var ts : vocabulary.findTermStatuses(user.getId(), lang)) {
                if (ts.getKind() == EntryKind.WORD) {
                    m.put(ts.getTerm(), ts.getStatus());
                }
            }
            return m;
        });
        Set<String> words = text.getWordsJson() == null ? UniqueWordsCache.distinct(tokens(text))
                : uniqueWords.words(text.getId(), text.getWordsJson(), stored -> KnownWords.readWords(stored, json));
        return KnownWords.stats(words, statuses);
    }

    static KnownStats stats(List<Token> tokens, Map<String, WordStatus> statuses) {
        return KnownWords.stats(tokens, statuses);
    }

    public TextSummary summarize(User viewer, Text text, KnownStats stats, Long likes, Boolean liked, Boolean bookmarked) {
        User owner = text.getOwner();
        return new TextSummary(text.getId(), text.getTitle(), text.getLanguage(), text.getCefrLevel(),
                text.getWordCount(), text.getUniqueWordCount(), text.isPublic(), text.getSourceUrl(),
                text.getCreatedAt(), OwnerDto.of(owner),
                owner.getId().equals(viewer.getId()), text.hasAudio(), likes, liked, bookmarked, stats,
                MediaKind.of(text), VideoViews.info(text), text.getCategory(), null);
    }

    private AudioDto audio(Text text) {
        if (!text.hasAudio()) {
            return null;
        }
        String src = text.getAudioFile() != null ? "/api/texts/" + text.getId() + "/audio" : text.getAudioUrl();
        return new AudioDto(src, text.getAudioContentType(), timings(text), text.getCuesJson() != null);
    }

    private List<AudioAligner.WordTiming> timings(Text text) {
        return text.getTimingsJson() == null ? List.of()
                : json.readValue(text.getTimingsJson(), new TypeReference<List<AudioAligner.WordTiming>>() {});
    }

    @Transactional
    public Text update(User user, Long id, String title, Boolean isPublic, Category category) {
        Text text = loadOwned(user, id);
        if (category != null) {
            text.setCategory(category);
        }
        if (title != null && !title.isBlank()) {
            text.setTitle(title.strip());
        }
        if (isPublic != null) {
            text.setPublic(isPublic);
        }
        return text;
    }

    @Transactional
    public void delete(User user, Long id) {
        Text text = loadOwned(user, id);
        vocabulary.detachText(id);
        sessions.detachText(id);
        progress.deleteByTextId(id);
        writings.detachText(id);
        reactions.deleteByTextId(id);
        playlistItems.deleteByTextId(id);
        assignments.deleteByTextId(id);
        events.publishEvent(new TextDeleted(id));
        storage.delete(text.getAudioFile());
        texts.delete(text);
    }
}
