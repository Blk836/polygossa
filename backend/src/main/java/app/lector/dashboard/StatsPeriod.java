package app.lector.dashboard;

import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum StatsPeriod {
    WEEK(7), MONTH(30), QUARTER(90), YEAR(365), ALL(0);

    private final int days;

    StatsPeriod(int days) {
        this.days = days;
    }

    public int days() {
        return days;
    }

    @JsonValue
    public String code() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static StatsPeriod parse(String value) {
        String code = value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
        for (StatsPeriod p : values()) {
            if (p.code().equals(code)) {
                return p;
            }
        }
        throw new IllegalArgumentException("period must be one of: week, month, quarter, year, all");
    }
}
