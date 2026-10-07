package app.lector.user;

import java.util.List;
import java.util.regex.Pattern;

/**
 * The first-visit tours an account gets: whether they're on, and which ones were already seen (finished or skipped).
 * The frontend owns the tours themselves; the server only remembers names.
 */
public record Tours(boolean on, List<String> seen) {

    /** Lower-case letters and dashes, starting with a letter. */
    static final Pattern NAME = Pattern.compile("[a-z][a-z-]{0,29}");

    /** Far more than the app has, so a client can't grow the list without bound. */
    static final int MAX_SEEN = 40;

    static boolean validName(String name) {
        return NAME.matcher(name).matches();
    }
}
