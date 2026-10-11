Feature: Uploads in real S3 are checked before production is deployed (#83)
  Development and the browser tests keep uploads in a local folder and the backend tests use a small fake S3, so
  real S3 (its endpoint, region and how it answers our requests) was first exercised live.

  Scenario: The app's S3 store works against the real bucket
    Given the live checks run with AWS credentials for the app's account and the uploads bucket's name
    When they save a small file under live-checks/ with the app's S3 store
    Then opening it returns the same bytes, with status 200
    And opening bytes 0-3 returns just those bytes, with status 206 and a Content-Range for the whole length
    And after deleting it, opening it finds nothing

  Scenario: The check cleans up after itself
    When the S3 live check finishes, passing or failing
    Then nothing it saved is left in the bucket

  Scenario: The deploy runs it against production's bucket before deploying
    Given I deploy with node tools/local-deploy.mjs
    When the live checks run in the deploy copy of main
    Then they are given the name of the PolygossaStaging stack's uploads bucket
    And if the bucket can't be found, or the check fails, production isn't touched and main gets a red mark

  Scenario: Without a bucket name the S3 check says what it needs
    When the live checks run by hand without LIVE_S3_BUCKET
    Then the S3 check fails saying to set LIVE_S3_BUCKET to the uploads bucket's name
