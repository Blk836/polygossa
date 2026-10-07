package app.lector.book;

import java.util.List;

/** A book read from an EPUB or PDF: its title and its chapters in reading order, each small enough for one text. */
public record Book(String title, List<Chapter> chapters) {

    public record Chapter(String title, String content) {}
}
