package app.lector.text;

import app.lector.common.ApiException;

public enum ContentLimit {
    TEXT(100_000, "Texts are limited to 100000 characters; split it into parts"),
    VIDEO(300_000, "This video's transcript is too long to import (the limit is about five hours of speech)");

    private final int maxChars;
    private final String tooLong;

    ContentLimit(int maxChars, String tooLong) {
        this.maxChars = maxChars;
        this.tooLong = tooLong;
    }

    public int maxChars() {
        return maxChars;
    }

    public void check(int length) {
        if (length > maxChars) {
            throw ApiException.badRequest(tooLong);
        }
    }
}
