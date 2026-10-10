package app.lector.wordimport;

import app.lector.common.ApiException;
import app.lector.token.Language;
import app.lector.user.User;
import app.lector.vocab.ImportCounts;
import app.lector.vocab.ImportedWord;
import app.lector.vocab.VocabularyImporter;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class WordImportService {

    static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    static final int BATCH = 500;
    static final String INTERRUPTED = "Interrupted: please start it again";
    static final String UNEXPECTED = "Something went wrong. Try again later.";

    private static final Logger log = LoggerFactory.getLogger(WordImportService.class);
    private static final Pattern API_KEY = Pattern.compile("[A-Za-z0-9_-]{1,100}");
    private static final Set<WordImport.State> ACTIVE = Set.of(WordImport.State.QUEUED, WordImport.State.RUNNING);

    @FunctionalInterface
    interface Fetcher {
        void fetch(BiConsumer<Language, List<ImportedWord>> onBatch);
    }

    private final WordImportRepository jobs;
    private final VocabularyImporter importer;
    private final LingqClient lingq;
    private final Clock clock;
    private final TransactionTemplate tx;
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "word-import");
        t.setDaemon(true);
        return t;
    });

    public WordImportService(WordImportRepository jobs, VocabularyImporter importer, LingqClient lingq, Clock clock,
                             PlatformTransactionManager transactions) {
        this.jobs = jobs;
        this.importer = importer;
        this.lingq = lingq;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactions);
    }

    public WordImportDto startLingq(User user, String apiKey, String language) {
        if (apiKey == null || apiKey.isBlank()) {
            throw ApiException.badRequest("Paste your LingQ API key: you'll find it at lingq.com/accounts/apikey.");
        }
        if (!API_KEY.matcher(apiKey).matches()) {
            throw ApiException.badRequest("That doesn't look like a LingQ API key. Copy it from lingq.com/accounts/apikey.");
        }
        Language only = language == null || language.isBlank() ? null : language(language);
        List<Language> languages = Language.scope(only);
        return queue(user, WordImport.Source.LINGQ, only, onBatch -> languages.forEach(lang ->
                lingq.fetchAll(apiKey, lang, words -> onBatch.accept(lang, words))));
    }

    public WordImportDto startReadlang(User user, MultipartFile file, String language) {
        if (language == null || language.isBlank()) {
            throw ApiException.badRequest("Choose the language of your Readlang words.");
        }
        Language lang = language(language);
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest(ReadlangParser.NO_WORDS);
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw ApiException.badRequest("This file is over 5 MB. Export only one language's words from Readlang.");
        }
        List<ImportedWord> words = ReadlangParser.parse(read(file));
        return queue(user, WordImport.Source.READLANG, lang, onBatch -> {
            for (int i = 0; i < words.size(); i += BATCH) {
                onBatch.accept(lang, words.subList(i, Math.min(words.size(), i + BATCH)));
            }
        });
    }

    public List<WordImportDto> recent(User user) {
        return jobs.findByUserIdOrderByIdDesc(user.getId()).stream()
                .map(WordImportDto::of).toList();
    }

    public WordImportDto get(User user, Long id) {
        return jobs.findByIdAndUserId(id, user.getId()).map(WordImportDto::of)
                .orElseThrow(() -> ApiException.notFound("Import"));
    }

    @EventListener(ApplicationReadyEvent.class)
    public void markInterrupted() {
        for (WordImport job : jobs.findByStateIn(ACTIVE)) {
            job.fail(INTERRUPTED, clock.instant());
            replaceEarlier(jobs.save(job));
        }
    }

    @PreDestroy
    void stop() {
        executor.shutdownNow();
    }

    private WordImportDto queue(User user, WordImport.Source source, Language language, Fetcher fetcher) {
        if (jobs.existsByUserIdAndStateIn(user.getId(), ACTIVE)) {
            throw ApiException.conflict("An import is already running");
        }
        WordImport job = jobs.save(new WordImport(user.getId(), source, language, clock.instant()));
        Long userId = user.getId();
        executor.execute(() -> run(job.getId(), userId, fetcher));
        return WordImportDto.of(job);
    }

    private void run(Long jobId, Long userId, Fetcher fetcher) {
        update(jobId, WordImport::start);
        try {
            fetcher.fetch((language, words) -> {
                ImportCounts counts = importer.importWords(userId, language, words);
                update(jobId, job -> job.record(words.size(), counts));
            });
            end(jobId, job -> job.finish(clock.instant()));
        } catch (LingqException | ApiException e) {
            end(jobId, job -> job.fail(e.getMessage(), clock.instant()));
        } catch (RuntimeException e) {
            log.warn("Word import {} failed", jobId, e);
            end(jobId, job -> job.fail(UNEXPECTED, clock.instant()));
        }
    }

    private void update(Long jobId, Consumer<WordImport> change) {
        jobs.findById(jobId).ifPresent(job -> {
            change.accept(job);
            jobs.save(job);
        });
    }

    private void end(Long jobId, Consumer<WordImport> change) {
        tx.executeWithoutResult(status -> jobs.findById(jobId).ifPresent(job -> {
            change.accept(job);
            replaceEarlier(jobs.save(job));
        }));
    }

    private void replaceEarlier(WordImport ended) {
        boolean succeeded = ended.getState() == WordImport.State.DONE;
        jobs.deleteAll(jobs.findByUserIdAndSource(ended.getUserId(), ended.getSource()).stream()
                .filter(old -> old.getId() < ended.getId() && Objects.equals(old.getLanguage(), ended.getLanguage()))
                .filter(old -> succeeded || old.getState() == WordImport.State.FAILED)
                .toList());
    }

    private static Language language(String code) {
        try {
            return Language.parse(code);
        } catch (Language.NotOfferedException e) {
            throw e;
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest(e.getMessage());
        }
    }

    private static String read(MultipartFile file) {
        try {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw ApiException.badRequest("The file couldn't be read.");
        }
    }
}
