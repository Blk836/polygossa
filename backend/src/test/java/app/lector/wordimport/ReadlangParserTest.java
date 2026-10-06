package app.lector.wordimport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.lector.common.ApiException;
import app.lector.vocab.ImportedWord;
import app.lector.vocab.WordStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Feature: Import my words from LingQ and Readlang, reading Readlang's export (docs/acceptance/word-import.feature). */
class ReadlangParserTest {

    private static ImportedWord learning(String term, String definition, String context) {
        return new ImportedWord(term, WordStatus.LEARNING, definition, context);
    }

    @Test
    void aHeaderRowNamesTheColumnsInAnyOrder() {
        String csv = "Context,Date Added,Translation,Word\n"
                + "Une maison bleue,2024-01-02,house / building,maison\n"
                + "Le chat dort,2024-01-03,cat,chat\n";
        assertThat(ReadlangParser.parse(csv)).containsExactly(
                learning("maison", "house / building", "Une maison bleue"),
                learning("chat", "cat", "Le chat dort"));
    }

    @Test
    void headerNamesAreMatchedLoosely() {
        String csv = " PHRASE ;Meaning;Example sentence\nmaison;house;Une maison\n";
        assertThat(ReadlangParser.parse(csv)).containsExactly(learning("maison", "house", "Une maison"));
        assertThat(ReadlangParser.parse("Term\tDefinition\nchat\tcat\n")).containsExactly(learning("chat", "cat", null));
    }

    @Test
    void withoutAHeaderTheColumnsAreWordTranslationContext() {
        assertThat(ReadlangParser.parse("maison,house,Une maison bleue\nchat,cat\nchien\n")).containsExactly(
                learning("maison", "house", "Une maison bleue"),
                learning("chat", "cat", null),
                learning("chien", null, null));
    }

    @Test
    void tabsWork() {
        assertThat(ReadlangParser.parse("maison\thouse, home\tUne maison, bleue\n"))
                .containsExactly(learning("maison", "house, home", "Une maison, bleue"));
    }

    @Test
    void quotedFieldsWithCommasQuotesAndNewlinesAndAByteOrderMark() {
        String csv = "﻿word,translation,context\r\n"
                + "\"tout à fait\",\"quite, \"\"exactly\"\"\",\"Il a dit:\nC'est tout à fait ça\"\r\n";
        assertThat(ReadlangParser.parse(csv)).containsExactly(
                learning("tout à fait", "quite, \"exactly\"", "Il a dit:\nC'est tout à fait ça"));
    }

    @Test
    void blankLinesAndRowsWithoutAWordAreSkipped() {
        String csv = "word,translation\n\n   \n,orphan\n\"  \",blank\nmaison,house\n";
        assertThat(ReadlangParser.parse(csv)).containsExactly(learning("maison", "house", null));
    }

    @Test
    void blankTranslationsAndContextsBecomeNull() {
        assertThat(ReadlangParser.parse("maison,  ,\t\n")).containsExactly(learning("maison", null, null));
    }

    @Test
    void anUnterminatedQuoteRunsToTheEnd() {
        assertThat(ReadlangParser.parse("maison,\"house")).containsExactly(learning("maison", "house", null));
    }

    @Test
    void aFileWithoutWordsIsRejected() {
        for (String empty : List.of("", "  \n\n", "word,translation\n", "﻿")) {
            assertThatThrownBy(() -> ReadlangParser.parse(empty)).isInstanceOf(ApiException.class)
                    .hasMessage("This file has no words in it. Export your words from Readlang and upload that file.");
        }
    }

    @Test
    void theDelimiterIsTheCommonestOnTheFirstLine() {
        assertThat(ReadlangParser.delimiter("a;b;c,d")).isEqualTo(';');
        assertThat(ReadlangParser.delimiter("a,b,c;d")).isEqualTo(',');
        assertThat(ReadlangParser.delimiter("a|b|c")).isEqualTo('|');
        assertThat(ReadlangParser.delimiter("a\tb,c")).isEqualTo('\t');
        assertThat(ReadlangParser.delimiter("word")).isEqualTo(',');
        assertThat(ReadlangParser.delimiter("\"a;b;c\",d")).isEqualTo(',');
    }
}
