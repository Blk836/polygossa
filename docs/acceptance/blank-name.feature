Feature: A name is never saved blank (#190)
  Settings › Name accepted a name of only spaces and stored it empty, so forum posts showed "?" with no author.

  Scenario: A name of only spaces is refused
    Given I'm on Settings › Profile
    When I type three spaces as my name and press Save
    Then it says my name can't be blank, not "Saved"
    And my name is unchanged

  Scenario: A name is saved without its outer spaces
    When I save "  Ana  " as my name
    Then my name is "Ana"

  Scenario: Accounts already saved with an empty name
    Given an account whose name was saved empty before this change
    Then its name becomes the part of its email before the @, as at sign-up
