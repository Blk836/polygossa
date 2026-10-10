package app.lector.storage;

import java.io.InputStream;
import org.springframework.core.io.AbstractResource;

final class StreamedFile extends AbstractResource {

    private final InputStream content;
    private final long length;
    private final String name;

    StreamedFile(InputStream content, long length, String name) {
        this.content = content;
        this.length = length;
        this.name = name;
    }

    @Override
    public InputStream getInputStream() {
        return content;
    }

    @Override
    public long contentLength() {
        return length;
    }

    @Override
    public String getFilename() {
        return name;
    }

    @Override
    public boolean exists() {
        return true;
    }

    @Override
    public String getDescription() {
        return "stored file " + name;
    }
}
