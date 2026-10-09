package app.lector.video;

import static org.assertj.core.api.Assertions.assertThat;

import app.lector.text.SubtitleParser.Cue;
import app.lector.text.SubtitleParser.WordMark;
import app.lector.token.Language;
import app.lector.video.CaptionParser.PlayerInfo;
import app.lector.video.CaptionParser.Track;
import java.util.List;
import org.junit.jupiter.api.Test;

class CaptionParserTest {

    @Test
    void parsesSrv3Paragraphs() {
        String xml = """
                <?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
                <body>
                <p t="18640" d="3240">Conocemos bien el amor</p>
                <p t="22640" d="4320">Tú conoces las reglas,
                igual que yo</p>
                </body></timedtext>""";
        assertThat(CaptionParser.parseTimedText(xml)).containsExactly(
                new Cue(18640, 21880, "Conocemos bien el amor", 0, 0),
                new Cue(22640, 26960, "Tú conoces las reglas, igual que yo", 0, 0));
    }

    @Test
    void joinsSrv3WordSegments() {
        String xml = "<timedtext format=\"3\"><body><p t=\"1000\" d=\"2000\" w=\"1\"><s ac=\"0\">Hola</s>"
                + "<s t=\"500\" ac=\"0\"> mundo</s></p></body></timedtext>";
        assertThat(CaptionParser.parseTimedText(xml)).containsExactly(
                new Cue(1000, 3000, "Hola mundo", 0, 0, List.of(new WordMark(0, 1000), new WordMark(5, 1500))));
    }

    @Test
    void keepsEachSrv3WordsOwnStartAsAMark() {
        String xml = "<timedtext><body><p t=\"2000\" d=\"3000\"><s>\n  il  </s><s t=\"400\">était\n</s>"
                + "<s t=\"900\">   </s><s t=\"1200\"> une&amp;#39;fois</s></p></body></timedtext>";
        Cue cue = CaptionParser.parseTimedText(xml).getFirst();
        assertThat(cue.text()).isEqualTo("il était une'fois");
        assertThat(cue.words()).containsExactly(new WordMark(0, 2000), new WordMark(3, 2400), new WordMark(9, 3200));
    }

    @Test
    void wordSegmentsWithoutSpacesJoinDirectly() {
        String xml = "<timedtext><body><p t=\"0\" d=\"900\"><s>今日は</s><s t=\"300\">いい</s><s t=\"600\">天気</s></p>"
                + "</body></timedtext>";
        Cue cue = CaptionParser.parseTimedText(xml).getFirst();
        assertThat(cue.text()).isEqualTo("今日はいい天気");
        assertThat(cue.words()).containsExactly(new WordMark(0, 0), new WordMark(3, 300), new WordMark(5, 600));
    }

    @Test
    void textBetweenWordSegmentsIsKeptWithoutAMark() {
        String xml = "<timedtext><body><p t=\"0\" d=\"900\"><s>un</s> et <s t=\"500\">deux</s></p></body></timedtext>";
        Cue cue = CaptionParser.parseTimedText(xml).getFirst();
        assertThat(cue.text()).isEqualTo("un et deux");
        assertThat(cue.words()).containsExactly(new WordMark(0, 0), new WordMark(6, 500));
    }

    @Test
    void unparseableWordOffsetsCountFromTheLineStart() {
        String xml = "<timedtext><body><p t=\"100\" d=\"900\"><s t=\"x\">un</s><s t=\"300\"> deux</s></p></body></timedtext>";
        assertThat(CaptionParser.parseTimedText(xml).getFirst().words())
                .containsExactly(new WordMark(0, 100), new WordMark(3, 400));
    }

    @Test
    void linesWithOnlyBlankWordSegmentsAreSkipped() {
        String xml = "<timedtext><body><p t=\"0\" d=\"10\"><s> </s></p><p t=\"20\" d=\"5\">ok</p></body></timedtext>";
        assertThat(CaptionParser.parseTimedText(xml)).containsExactly(new Cue(20, 25, "ok", 0, 0));
    }

    @Test
    void plainLinesHaveNoWordMarks() {
        String xml = "<timedtext><body><p t=\"0\" d=\"10\">un deux</p></body></timedtext>";
        assertThat(CaptionParser.parseTimedText(xml).getFirst().words()).isEmpty();
    }

    @Test
    void requestsTheSrv3FormatInPlaceOfAnyOther() {
        assertThat(CaptionParser.srv3Url("https://y.test/api/timedtext?v=a&lang=es"))
                .isEqualTo("https://y.test/api/timedtext?v=a&lang=es&fmt=srv3");
        assertThat(CaptionParser.srv3Url("https://y.test/api/timedtext?fmt=vtt&v=a&fmt=json3"))
                .isEqualTo("https://y.test/api/timedtext?v=a&fmt=srv3");
        assertThat(CaptionParser.srv3Url("https://y.test/api/timedtext?v=a&format=x"))
                .isEqualTo("https://y.test/api/timedtext?v=a&format=x&fmt=srv3");
        assertThat(CaptionParser.srv3Url("https://y.test/api/timedtext"))
                .isEqualTo("https://y.test/api/timedtext?fmt=srv3");
        assertThat(CaptionParser.srv3Url("https://y.test/api/timedtext?fmt=vtt"))
                .isEqualTo("https://y.test/api/timedtext?fmt=srv3");
    }

    @Test
    void parsesLegacyTranscriptFormat() {
        String xml = "<?xml version=\"1.0\" encoding=\"utf-8\" ?><transcript><text start=\"18.64\" dur=\"3.24\">"
                + "Conocemos bien</text><text start=\"43\" dur=\"2.12\">Nunca te\nabandonaré</text>"
                + "<text start=\"50.5\">sin duración</text></transcript>";
        assertThat(CaptionParser.parseTimedText(xml)).containsExactly(
                new Cue(18640, 21880, "Conocemos bien", 0, 0),
                new Cue(43000, 45120, "Nunca te abandonaré", 0, 0),
                new Cue(50500, 50500, "sin duración", 0, 0));
    }

    @Test
    void decodesDoublyEscapedEntities() {
        String xml = "<transcript><text start=\"1\" dur=\"1\">it&amp;#39;s &quot;fine&quot; &amp;amp; ok</text></transcript>";
        assertThat(CaptionParser.parseTimedText(xml)).extracting(Cue::text).containsExactly("it's \"fine\" & ok");
    }

    @Test
    void skipsBlankAndUntimedParagraphs() {
        String xml = "<timedtext><body><p t=\"0\" d=\"10\">\n</p><p d=\"5\">no start</p><p t=\"x\" d=\"1\">bad</p>"
                + "<p t=\"20\" d=\"5\">ok</p></body></timedtext>";
        assertThat(CaptionParser.parseTimedText(xml)).containsExactly(new Cue(20, 25, "ok", 0, 0));
    }

    @Test
    void returnsNothingForNonCaptionBodies() {
        assertThat(CaptionParser.parseTimedText("")).isEmpty();
        assertThat(CaptionParser.parseTimedText(null)).isEmpty();
        assertThat(CaptionParser.parseTimedText("<html><body>Sorry</body></html>")).isEmpty();
    }

    private static final String PLAYER = """
            {"playabilityStatus": {"status": "OK"},
             "videoDetails": {"videoId": "dQw4w9WgXcQ", "lengthSeconds": "213"},
             "captions": {"playerCaptionsTracklistRenderer": {"captionTracks": [
               {"baseUrl": "https://www.youtube.com/api/timedtext?v=1&lang=en&fmt=srv3", "languageCode": "en"},
               {"baseUrl": "https://www.youtube.com/api/timedtext?v=1&kind=asr&lang=en", "languageCode": "en", "kind": "asr"},
               {"baseUrl": "https://www.youtube.com/api/timedtext?v=1&lang=es-419", "languageCode": "es-419"},
               {"languageCode": "fr"}
             ], "translationLanguages": [{"languageCode": "de"}]}}}""";

    @Test
    void readsDurationAndCaptionTracks() {
        PlayerInfo info = CaptionParser.parsePlayer(PLAYER);
        assertThat(info.durationSeconds()).isEqualTo(213);
        assertThat(info.tracks()).containsExactly(
                new Track("https://www.youtube.com/api/timedtext?v=1&lang=en&fmt=srv3", "en", false),
                new Track("https://www.youtube.com/api/timedtext?v=1&kind=asr&lang=en", "en", true),
                new Track("https://www.youtube.com/api/timedtext?v=1&lang=es-419", "es-419", false));
    }

    @Test
    void unplayableVideosHaveNoTracks() {
        String json = PLAYER.replace("\"OK\"", "\"LOGIN_REQUIRED\"");
        PlayerInfo info = CaptionParser.parsePlayer(json);
        assertThat(info.tracks()).isEmpty();
        assertThat(info.durationSeconds()).isEqualTo(213);
    }

    @Test
    void toleratesMissingOrMalformedFields() {
        assertThat(CaptionParser.parsePlayer("{\"playabilityStatus\":{\"status\":\"OK\"}}"))
                .isEqualTo(new PlayerInfo(null, List.of()));
        assertThat(CaptionParser.parsePlayer("{\"videoDetails\":{\"lengthSeconds\":\"abc\"}}"))
                .isEqualTo(new PlayerInfo(null, List.of()));
        assertThat(CaptionParser.parsePlayer("not json")).isEqualTo(new PlayerInfo(null, List.of()));
        assertThat(CaptionParser.parsePlayer(null)).isEqualTo(new PlayerInfo(null, List.of()));
        assertThat(CaptionParser.parsePlayer("{\"videoDetails\":{\"lengthSeconds\":\"0\"}}").durationSeconds()).isNull();
    }

    private static Track t(String lang, boolean asr) {
        return new Track("u-" + lang + (asr ? "-asr" : ""), lang, asr);
    }

    @Test
    void prefersAutoGeneratedCaptionsForTheirWordTimings() {
        assertThat(CaptionParser.pickTrack(List.of(t("es", false), t("es", true)), Language.ES))
                .contains(t("es", true));
        assertThat(CaptionParser.pickTrack(List.of(t("es", true), t("es", false)), Language.ES))
                .contains(t("es", true));
    }

    @Test
    void manualCaptionsAreUsedWhenThereAreNoAutoGeneratedOnes() {
        assertThat(CaptionParser.pickTrack(List.of(t("ja", true), t("es", false)), Language.ES))
                .contains(t("es", false));
    }

    @Test
    void prefersExactLanguageOverRegionalVariant() {
        assertThat(CaptionParser.pickTrack(List.of(t("es-419", false), t("es", false)), Language.ES))
                .contains(t("es", false));
        assertThat(CaptionParser.pickTrack(List.of(t("es-419", true), t("es", true)), Language.ES))
                .contains(t("es", true));
        assertThat(CaptionParser.pickTrack(List.of(t("es", false), t("es-419", true)), Language.ES))
                .contains(t("es-419", true));
    }

    @Test
    void acceptsRegionalVariantsCaseInsensitively() {
        assertThat(CaptionParser.pickTrack(List.of(t("zh-Hans", false)), Language.ZH)).contains(t("zh-Hans", false));
        assertThat(CaptionParser.pickTrack(List.of(t("PT-BR", true)), Language.PT)).contains(t("PT-BR", true));
    }

    @Test
    void ignoresOtherLanguagesAndLookalikeCodes() {
        assertThat(CaptionParser.pickTrack(List.of(t("en", false), t("est", false), t("esx", true)), Language.ES))
                .isEmpty();
        assertThat(CaptionParser.pickTrack(List.of(), Language.ES)).isEmpty();
    }

    @Test
    void autoGeneratedIsUsedWhenThatIsAllThereIs() {
        assertThat(CaptionParser.pickTrack(List.of(t("en", false), t("ja", true)), Language.JA)).contains(t("ja", true));
    }

    @Test
    void extractsTheInnertubeApiKey() {
        assertThat(CaptionParser.apiKey("x \"INNERTUBE_API_KEY\":\"AIza_k-1\", y")).contains("AIza_k-1");
        assertThat(CaptionParser.apiKey("x \"INNERTUBE_API_KEY\": \"AIzaK2\"")).contains("AIzaK2");
        assertThat(CaptionParser.apiKey("<html>nothing</html>")).isEmpty();
        assertThat(CaptionParser.apiKey(null)).isEmpty();
    }

    @Test
    void readsYouTubesOwnCategoryFromThePlayerMicroformat() {
        String page = "<script>var ytInitialPlayerResponse = {\"microformat\":{\"playerMicroformatRenderer\":"
                + "{\"title\":{\"simpleText\":\"E188\"},\"category\":\"Education\",\"publishDate\":\"x\"}}};</script>";
        assertThat(CaptionParser.youtubeCategory(page)).contains("Education");
        assertThat(CaptionParser.youtubeCategory("{\"category\": \"People & Blogs\"}")).contains("People & Blogs");
    }

    @Test
    void decodesEscapedAmpersandsInTheCategory() {
        assertThat(CaptionParser.youtubeCategory("{\"category\":\"News \u0026 Politics\"}")).contains("News & Politics");
    }

    @Test
    void missingCategoryIsEmpty() {
        assertThat(CaptionParser.youtubeCategory("<html>nothing</html>")).isEmpty();
        assertThat(CaptionParser.youtubeCategory("{\"category\":\"\"}")).isEmpty();
        assertThat(CaptionParser.youtubeCategory(null)).isEmpty();
    }
}
