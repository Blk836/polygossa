Feature: A request the API can't route gets a clear client error, not a server error (#101)

  Scenario: An API path that doesn't exist
    Given I am signed in
    When I GET "/api/sentences", a path the API doesn't have
    Then the answer is 404 with code "not_found"

  Scenario: An unknown path under an existing one
    Given I am signed in
    When I GET "/api/me/no-such-thing"
    Then the answer is 404 with code "not_found"

  Scenario: An existing path with a method it doesn't support
    Given I am signed in
    When I PUT "/api/me/export", which only answers GET
    Then the answer is 405 with code "method_not_allowed"

  Scenario: A body in a type the endpoint doesn't take
    Given I am signed in
    When I POST plain text to "/api/texts", which takes JSON
    Then the answer is 415 with code "unsupported_media_type"

  Scenario: Signed out, an unknown path still needs sign-in first
    Given I am not signed in
    When I GET "/api/sentences"
    Then the answer is 401, as for any API path, so signed-out callers can't probe which paths exist
