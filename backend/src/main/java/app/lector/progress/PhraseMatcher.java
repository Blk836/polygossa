package app.lector.progress;

import app.lector.token.Token;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

final class PhraseMatcher {

    private final List<Token> tokens;
    private final int[] starts;
    private final String form;
    private final int[] at;

    PhraseMatcher(List<Token> tokens) {
        this.tokens = tokens;
        this.starts = new int[tokens.size()];
        StringBuilder text = new StringBuilder();
        for (int k = 0; k < tokens.size(); k++) {
            starts[k] = text.length();
            text.append(tokens.get(k).text());
        }
        StringBuilder out = new StringBuilder();
        List<Integer> positions = new ArrayList<>();
        boolean spaced = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            boolean space = Character.isWhitespace(c);
            if (space && spaced) {
                continue;
            }
            String piece = space ? " " : c == '’' ? "'" : String.valueOf(c).toLowerCase(Locale.ROOT);
            out.append(piece);
            for (int k = 0; k < piece.length(); k++) {
                positions.add(i);
            }
            spaced = space;
        }
        this.form = out.toString();
        this.at = positions.stream().mapToInt(Integer::intValue).toArray();
    }

    static String normalize(String term) {
        return term.strip().replace('’', '\'').replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    List<Integer> ends(String phrase) {
        String term = normalize(phrase);
        List<Integer> out = new ArrayList<>();
        if (term.isEmpty()) {
            return out;
        }
        for (int i = form.indexOf(term); i >= 0; i = form.indexOf(term, i + term.length())) {
            int last = lastWordWithin(at[i], at[i + term.length() - 1]);
            if (last >= 0) {
                out.add(last);
            }
        }
        return out;
    }

    private int lastWordWithin(int from, int to) {
        int k = Arrays.binarySearch(starts, from);
        int last = -1;
        for (k = k >= 0 ? firstAt(k) : -k - 1; k < tokens.size() && starts[k] <= to; k++) {
            if (tokens.get(k).word()) {
                last = tokens.get(k).index();
            }
        }
        return last;
    }

    private int firstAt(int k) {
        int first = k;
        while (first > 0 && starts[first - 1] == starts[k]) {
            first--;
        }
        return first;
    }
}
