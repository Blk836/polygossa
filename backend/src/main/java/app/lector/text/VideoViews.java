package app.lector.text;

import app.lector.text.TextDtos.VideoDto;
import app.lector.text.TextDtos.VideoInfo;
import java.util.List;
import java.util.function.Supplier;

public final class VideoViews {

    private VideoViews() {}

    public static String thumbnailUrl(String videoId) {
        return "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg";
    }

    static VideoInfo info(Text text) {
        if (!text.isVideo()) {
            return null;
        }
        return new VideoInfo(text.getVideoId(), thumbnailUrl(text.getVideoId()), text.getVideoDurationSeconds());
    }

    static VideoDto dto(Text text, List<AudioAligner.WordTiming> stored,
                        Supplier<List<AudioAligner.WordTiming>> fromCues) {
        if (!text.isVideo()) {
            return null;
        }
        boolean hasCues = text.getCuesJson() != null;
        List<AudioAligner.WordTiming> timings = hasCues ? fromCues.get() : stored;
        return new VideoDto(text.getVideoId(), text.getVideoDurationSeconds(), timings, hasCues);
    }
}
