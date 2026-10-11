Feature: The old cloudfront.net address is retired (#139)
  Production moved to polygossa.com. The transition support for the old d3pd9mue4v7won.cloudfront.net address is
  no longer needed: there are no real users. Supersedes "the old address stays an allowed sign-in return for one
  transition" in custom-domain.feature.

  Scenario: sign-in and sign-out return only to the domain
    When the production stack is built with the domain live
    Then Cognito's callback URLs are only "https://polygossa.com/api/auth/callback"
    And its sign-out URLs are only "https://polygossa.com/"

  Scenario: no setting names the old address
    Then the CDK settings have no "site-url"
    And nothing in the stack reads it

  Scenario: a stack without a live domain uses the distribution's own address
    When the production stack is built without a live domain
    Then APP_URL (backend and frontend), Cognito's returns and the SiteUrl output are all the distribution's
      cloudfront.net address
    And none of it is a placeholder address

  Scenario: any other host name, the old address included, still gets a permanent redirect to the domain
    # Decision: keep the 301 rather than refusing. It costs nothing, a 301 is how search engines are told which
    # address is the real one (so they don't list a second copy), and any old link still lands on the site.
    When a visitor opens https://d3pd9mue4v7won.cloudfront.net/reader/42?page=3
    Then they are sent with a permanent redirect to https://polygossa.com/reader/42?page=3
    And www.polygossa.com is still sent to the bare domain
