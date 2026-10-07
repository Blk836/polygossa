package app.lector.export;

import app.lector.vocab.VocabularyEntry;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.jsoup.Jsoup;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes an Anki package (.apkg): a zip holding {@code collection.anki2} (an SQLite database in Anki's schema 11
 * format, which every Anki version imports) and an empty {@code media} map.
 */
public final class AnkiExporter {

    /** Fixed so re-imports update the same note type rather than creating a duplicate. */
    static final long MODEL_ID = 1_607_392_319_001L;
    private static final String FIELD_SEPARATOR = "\u001f";
    private static final String GUID_CHARS =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private AnkiExporter() {}

    public static byte[] export(String brand, String deckName, List<VocabularyEntry> entries) {
        Path db = null;
        try {
            db = Files.createTempFile("lector-anki", ".anki2");
            Files.delete(db); // let SQLite create it fresh
            long deckId = Math.abs(deckName.hashCode()) + 1_000_000_000L;
            try (Connection conn = DriverManager.getConnection("jdbc:sqlite:" + db.toAbsolutePath())) {
                conn.setAutoCommit(false);
                createSchema(conn);
                insertCollection(conn, deckId, brand, deckName);
                insertNotes(conn, deckId, entries);
                conn.commit();
            }
            return zip(Files.readAllBytes(db));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to build Anki package", e);
        } finally {
            if (db != null) {
                try {
                    Files.deleteIfExists(db);
                } catch (IOException ignored) {
                    // temp file cleanup is best effort
                }
            }
        }
    }

    private static void createSchema(Connection conn) throws SQLException {
        try (Statement st = conn.createStatement()) {
            st.executeUpdate("""
                    CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null,
                      scm integer not null, ver integer not null, dty integer not null, usn integer not null,
                      ls integer not null, conf text not null, models text not null, decks text not null,
                      dconf text not null, tags text not null)""");
            st.executeUpdate("""
                    CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null,
                      mod integer not null, usn integer not null, tags text not null, flds text not null,
                      sfld integer not null, csum integer not null, flags integer not null, data text not null)""");
            st.executeUpdate("""
                    CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null,
                      ord integer not null, mod integer not null, usn integer not null, type integer not null,
                      queue integer not null, due integer not null, ivl integer not null, factor integer not null,
                      reps integer not null, lapses integer not null, left integer not null, odue integer not null,
                      odid integer not null, flags integer not null, data text not null)""");
            st.executeUpdate("""
                    CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null,
                      ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null,
                      time integer not null, type integer not null)""");
            st.executeUpdate("CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null)");
            st.executeUpdate("CREATE INDEX ix_notes_usn on notes (usn)");
            st.executeUpdate("CREATE INDEX ix_cards_usn on cards (usn)");
            st.executeUpdate("CREATE INDEX ix_revlog_usn on revlog (usn)");
            st.executeUpdate("CREATE INDEX ix_cards_nid on cards (nid)");
            st.executeUpdate("CREATE INDEX ix_cards_sched on cards (did, queue, due)");
            st.executeUpdate("CREATE INDEX ix_revlog_cid on revlog (cid)");
            st.executeUpdate("CREATE INDEX ix_notes_csum on notes (csum)");
        }
    }

    private static void insertCollection(Connection conn, long deckId, String brand, String deckName) throws SQLException {
        long nowSec = System.currentTimeMillis() / 1000;
        long nowMs = System.currentTimeMillis();

        Map<String, Object> conf = new LinkedHashMap<>();
        conf.put("activeDecks", List.of(1));
        conf.put("addToCur", true);
        conf.put("collapseTime", 1200);
        conf.put("curDeck", 1);
        conf.put("curModel", String.valueOf(MODEL_ID));
        conf.put("dueCounts", true);
        conf.put("estTimes", true);
        conf.put("newBury", true);
        conf.put("newSpread", 0);
        conf.put("nextPos", 1);
        conf.put("sortBackwards", false);
        conf.put("sortType", "noteFld");
        conf.put("timeLim", 0);

        Map<String, Object> decks = new LinkedHashMap<>();
        decks.put("1", deck(1, "Default", "", nowSec));
        decks.put(String.valueOf(deckId), deck(deckId, deckName, "Exported from " + brand, nowSec));

        Map<String, Object> dconf = Map.of("1", Map.ofEntries(
                Map.entry("autoplay", true),
                Map.entry("id", 1),
                Map.entry("lapse", Map.of("delays", List.of(10), "leechAction", 0, "leechFails", 8, "minInt", 1,
                        "mult", 0)),
                Map.entry("maxTaken", 60),
                Map.entry("mod", 0),
                Map.entry("name", "Default"),
                Map.entry("new", Map.of("bury", true, "delays", List.of(1, 10), "initialFactor", 2500,
                        "ints", List.of(1, 4, 7), "order", 1, "perDay", 20, "separate", true)),
                Map.entry("replayq", true),
                Map.entry("rev", Map.of("bury", true, "ease4", 1.3, "fuzz", 0.05, "ivlFct", 1, "maxIvl", 36500,
                        "minSpace", 1, "perDay", 100)),
                Map.entry("timer", 0),
                Map.entry("usn", 0)));

        Map<String, Object> models = Map.of(String.valueOf(MODEL_ID), AnkiModel.model(MODEL_ID, deckId, brand + " Vocabulary", nowSec));

        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')")) {
            ps.setLong(1, nowSec);
            ps.setLong(2, nowMs);
            ps.setLong(3, nowMs);
            ps.setString(4, JSON.writeValueAsString(conf));
            ps.setString(5, JSON.writeValueAsString(models));
            ps.setString(6, JSON.writeValueAsString(decks));
            ps.setString(7, JSON.writeValueAsString(dconf));
            ps.executeUpdate();
        }
    }

    private static Map<String, Object> deck(long id, String name, String description, long mod) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("collapsed", false);
        d.put("conf", 1);
        d.put("desc", description);
        d.put("dyn", 0);
        d.put("extendNew", 10);
        d.put("extendRev", 50);
        d.put("id", id);
        d.put("lrnToday", List.of(0, 0));
        d.put("mod", mod);
        d.put("name", name);
        d.put("newToday", List.of(0, 0));
        d.put("revToday", List.of(0, 0));
        d.put("timeToday", List.of(0, 0));
        d.put("usn", -1);
        return d;
    }

    private static void insertNotes(Connection conn, long deckId, List<VocabularyEntry> entries) throws SQLException {
        long nowSec = System.currentTimeMillis() / 1000;
        long baseId = System.currentTimeMillis();
        try (PreparedStatement note = conn.prepareStatement("INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')");
             PreparedStatement card = conn.prepareStatement(
                     "INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')")) {
            int position = 0;
            for (VocabularyEntry e : entries) {
                long noteId = baseId + position * 2L;
                long cardId = noteId + 1;
                String word = html(e.getDisplayTerm());
                List<String> values = List.of(word, html(e.getDefinition()), html(e.getPronunciation()),
                        html(e.getPartOfSpeech()), html(e.getContextSentence()), html(e.getExample()),
                        e.getLanguage().displayName(), html(e.getNote()));
                note.setLong(1, noteId);
                note.setString(2, guid());
                note.setLong(3, MODEL_ID);
                note.setLong(4, nowSec);
                // The "lector" tag is fixed, not the brand: notes imported before a rename keep matching.
                note.setString(5, " lector " + e.getLanguage().code() + " " + e.getStatus().json() + " "
                        + e.getTags().stream().map(t -> t + " ").collect(Collectors.joining()));
                note.setString(6, String.join(FIELD_SEPARATOR, values));
                note.setString(7, word);
                note.setLong(8, checksum(word));
                note.addBatch();

                card.setLong(1, cardId);
                card.setLong(2, noteId);
                card.setLong(3, deckId);
                card.setLong(4, nowSec);
                card.setLong(5, position + 1);
                card.addBatch();
                position++;
            }
            note.executeBatch();
            card.executeBatch();
        }
    }

    private static String html(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>");
    }

    /** Anki's duplicate-detection checksum: first 8 hex digits of SHA-1 of the stripped first field. */
    static long checksum(String field) {
        try {
            String stripped = Jsoup.parse(field).text();
            byte[] sha = MessageDigest.getInstance("SHA-1").digest(stripped.getBytes(StandardCharsets.UTF_8));
            return Long.parseLong(HexFormat.of().formatHex(sha).substring(0, 8), 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String guid() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            sb.append(GUID_CHARS.charAt(RANDOM.nextInt(GUID_CHARS.length())));
        }
        return sb.toString();
    }

    private static byte[] zip(byte[] collection) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("collection.anki2"));
            zip.write(collection);
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("media"));
            zip.write("{}".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return out.toByteArray();
    }
}
