package app.lector.user;

/** The authenticated principal placed in the security context by the JWT filter. */
public record AuthUser(Long id, String email) {}
