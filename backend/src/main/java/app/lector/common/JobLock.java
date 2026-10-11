package app.lector.common;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.zip.CRC32;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class JobLock {

    private final JdbcTemplate jdbc;

    public JobLock(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public <T> Optional<T> runAlone(String job, Supplier<T> work) {
        long key = key(job);
        return jdbc.execute((ConnectionCallback<Optional<T>>) connection -> {
            if (!call(connection, "select pg_try_advisory_lock(?)", key)) {
                return Optional.empty();
            }
            try {
                return Optional.ofNullable(work.get());
            } finally {
                call(connection, "select pg_advisory_unlock(?)", key);
            }
        });
    }

    public static long key(String job) {
        CRC32 crc = new CRC32();
        crc.update(("job:" + job).getBytes(StandardCharsets.UTF_8));
        return crc.getValue();
    }

    private static boolean call(Connection connection, String sql, long key) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setLong(1, key);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getBoolean(1);
            }
        }
    }
}
