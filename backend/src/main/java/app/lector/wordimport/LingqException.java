package app.lector.wordimport;

/** LingQ couldn't give us the words; the message is shown to the learner as the import's error. */
public class LingqException extends RuntimeException {

    public LingqException(String message) {
        super(message);
    }
}
