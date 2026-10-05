package app.lector.text;

/** Published inside the delete's transaction, so other packages can remove what they keep about the text. */
public record TextDeleted(Long textId) {}
