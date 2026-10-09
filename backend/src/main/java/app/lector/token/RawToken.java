package app.lector.token;

record RawToken(String text, boolean word, String lemma, String reading) {

    static RawToken word(String text) {
        return new RawToken(text, true, null, null);
    }

    static RawToken other(String text) {
        return new RawToken(text, false, null, null);
    }
}
