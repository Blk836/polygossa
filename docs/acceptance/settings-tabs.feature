Feature: Settings sub-tabs (Profile, Appearance, Subscription)
  Settings gets a sub-tab strip like Library and Practice, instead of one long page.
  Classes stays its own page, outside this strip.

  Background:
    Given I am signed in

  Scenario: Settings pages show the sub-tab strip
    When I open /settings
    Then I see a "Settings pages" strip with Profile, Appearance, Subscription
    And "Profile" is the current sub-tab
    And no main tab (Library, Practice, Progress) is marked current

  Scenario Outline: Each sub-tab opens its own page
    When I click "<tab>" in the strip
    Then the URL is <url>
    And "<tab>" is the current sub-tab
    And I see <content>
    And I don't see <other>

    Examples:
      | tab          | url                    | content                         | other                  |
      | Profile      | /settings              | the Name field                  | the plan cards         |
      | Appearance   | /settings/appearance   | the theme picker                | the Name field         |
      | Subscription | /settings/subscription | the Free, Pro and Classroom cards | the theme picker     |

  Scenario: Classes is not part of the strip
    When I open /classes
    Then no "Settings pages" strip is shown

  Scenario: Saving the profile
    Given I am on Profile
    When I change my name and click Save
    Then I see "Saved"
    And the account menu shows the new name

  Scenario: Profile save fails
    Given the backend rejects the profile update
    When I click Save
    Then an error message is shown and "Saved" is not

  Scenario: Switching plan
    Given I am on Subscription with the Classroom plan
    When I click "Switch to Pro"
    Then the Pro card shows "Current plan"
    And the account menu badge reads "Pro plan"

  Scenario: Plan switch fails
    Given the plan change request fails
    When I click "Switch to Pro"
    Then an error message is shown on Subscription
    And Classroom is still the current plan

  Scenario: Usage shown only on a limited plan
    Given my plan is unlimited
    Then no usage line is shown
    When I move to the Free plan
    Then I see "Usage: <texts>/<limit> texts · <words>/<limit> saved words"

  Scenario: Pro through a teacher's Classroom plan
    Given my Pro access comes from a teacher's Classroom plan
    Then Subscription says "You have Pro features through your teacher's Classroom plan."

  Scenario Outline: Old links land on the right tab
    When I open <old>
    Then I end up on <new>

    Examples:
      | old                   | new                    |
      | /settings#plan        | /settings/subscription |
      | /settings#appearance  | /settings/appearance   |

  Scenario: "See plans" links go to Subscription
    Given an upgrade note, the reader's "AI examples with Pro" link or the Classes page's "Classroom plan" link
    Then it points to /settings/subscription

  Scenario: Phone width
    Given a 390px-wide viewport
    When I open /settings/subscription
    Then the strip is visible with Subscription current
    And the page doesn't scroll sideways
