package app.lector.user;

import java.util.List;
import java.util.regex.Pattern;

public record Tours(boolean on, List<String> seen) {

    static final Pattern NAME = Pattern.compile("[a-z][a-z-]{0,29}");

    static final int MAX_SEEN = 40;

    static boolean validName(String name) {
        return NAME.matcher(name).matches();
    }
}
