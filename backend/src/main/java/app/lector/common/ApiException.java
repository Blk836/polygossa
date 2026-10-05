package app.lector.common;

import org.springframework.http.HttpStatus;

/** An error that maps directly onto an HTTP response with a user-facing message. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, "not_found", what + " not found");
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "forbidden", message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "bad_request", message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, "conflict", message);
    }

    /** The request is well-formed but can't be carried out (e.g. a video with no usable captions). */
    public static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "unprocessable", message);
    }

    /** The user's plan does not include a feature or they hit a plan limit. */
    public static ApiException upgradeRequired(String message) {
        return new ApiException(HttpStatus.PAYMENT_REQUIRED, "upgrade_required", message);
    }
}
