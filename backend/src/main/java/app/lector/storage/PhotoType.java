package app.lector.storage;

public final class PhotoType {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};

    private PhotoType() {}

    public static String of(byte[] bytes) {
        if (startsWith(bytes, PNG)) {
            return "png";
        }
        return startsWith(bytes, JPEG) ? "jpg" : null;
    }

    public static String mediaType(String storedName) {
        return storedName.endsWith(".png") ? "image/png" : "image/jpeg";
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
