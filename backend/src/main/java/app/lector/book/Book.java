package app.lector.book;

import java.util.List;

public record Book(String title, List<Chapter> chapters) {

    public record Chapter(String title, String content) {}
}
