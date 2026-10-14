package app.lector.video;

import app.lector.video.TidyLines.Word;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

final class WordAlignment {

    private enum Op { SAME, SWAP, PUT_BACK, TAKE_OUT }

    private record Edit(int at, int length, String text, boolean counts) {}

    private static final long MAX_CELLS = 1_000_000;

    private WordAlignment() {}

    static Optional<String> restore(List<Word> spoken, List<Word> written, String text, Set<String> fillers) {
        if ((long) (spoken.size() + 1) * (written.size() + 1) > MAX_CELLS) {
            return Optional.empty();
        }
        int[][] cost = costs(spoken, written);
        List<Edit> edits = new ArrayList<>();
        int i = 0;
        int j = 0;
        while (i < spoken.size() || j < written.size()) {
            switch (op(cost, spoken, written, i, j)) {
                case SAME -> {
                    i++;
                    j++;
                }
                case SWAP -> {
                    Word word = written.get(j++);
                    edits.add(new Edit(word.offset(), word.text().length(), spoken.get(i++).text(), true));
                }
                case PUT_BACK -> edits.add(putBack(spoken.get(i++), written, j, text, fillers));
                case TAKE_OUT -> edits.add(takeOut(written.get(j++), text));
            }
        }
        long changed = edits.stream().filter(Edit::counts).count();
        return changed > Math.max(1, spoken.size() / 10) ? Optional.empty() : Optional.of(apply(text, edits));
    }

    private static Op op(int[][] cost, List<Word> spoken, List<Word> written, int i, int j) {
        boolean both = i < spoken.size() && j < written.size();
        if (both && spoken.get(i).key().equals(written.get(j).key()) && cost[i][j] == cost[i + 1][j + 1]) {
            return Op.SAME;
        }
        if (both && cost[i][j] == 1 + cost[i + 1][j + 1]) {
            return Op.SWAP;
        }
        if (i < spoken.size() && cost[i][j] == 1 + cost[i + 1][j]) {
            return Op.PUT_BACK;
        }
        return Op.TAKE_OUT;
    }

    private static int[][] costs(List<Word> spoken, List<Word> written) {
        int n = spoken.size();
        int m = written.size();
        int[][] cost = new int[n + 1][m + 1];
        for (int i = n; i >= 0; i--) {
            for (int j = m; j >= 0; j--) {
                if (i == n || j == m) {
                    cost[i][j] = (n - i) + (m - j);
                } else {
                    int pair = spoken.get(i).key().equals(written.get(j).key()) ? 0 : 1;
                    cost[i][j] = Math.min(pair + cost[i + 1][j + 1], 1 + Math.min(cost[i + 1][j], cost[i][j + 1]));
                }
            }
        }
        return cost;
    }

    private static Edit putBack(Word word, List<Word> written, int j, String text, Set<String> fillers) {
        boolean counts = !fillers.contains(word.key());
        if (j < written.size()) {
            return new Edit(written.get(j).offset(), 0, word.text() + " ", counts);
        }
        int end = written.isEmpty() ? text.length() : written.getLast().offset() + written.getLast().text().length();
        return new Edit(end, 0, " " + word.text(), counts);
    }

    private static Edit takeOut(Word word, String text) {
        int end = word.offset() + word.text().length();
        boolean space = end < text.length() && text.charAt(end) == ' ';
        return new Edit(word.offset(), word.text().length() + (space ? 1 : 0), "", true);
    }

    private static String apply(String text, List<Edit> edits) {
        StringBuilder out = new StringBuilder(text);
        for (Edit edit : edits.reversed()) {
            out.replace(edit.at(), edit.at() + edit.length(), edit.text());
        }
        return out.toString();
    }
}
