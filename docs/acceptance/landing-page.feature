Feature: Landing page that turns visitors into sign-ups
  The home page (/) sells the product to someone who has never used it, and every path through it ends at
  "create an account". It lets visitors try the reader before signing up (click words in a sample text), lets them
  pick the language they want up front and carries that choice through sign-up into onboarding, and answers the
  usual objections (price, level, which languages) on the page. No invented testimonials, user counts or ratings:
  proof comes from the product itself (the live demo, real features, real plan limits).

  # Reaching the page
  Scenario: Signed-out visitors see the landing page
    Given I have no session
    When I open /
    Then I see the landing page, not the library
    And the header offers "Sign in" and a "Start free" button linking to /signup

  Scenario: Dev auto-login no longer hides the landing page
    Given AUTO_LOGIN is on (the dev default) and I have no session
    When I open /
    Then I see the landing page instead of being signed in and redirected to /library
    And opening any app page (e.g. /library) still auto-signs me in as before
    And /login and /signup still auto-sign me in and go to the library

  Scenario: Signed-in visitors are offered the app, not sign-up
    Given I am signed in
    When I open /
    Then the header shows "Open library" linking to /library instead of "Sign in" / "Start free"

  Scenario: The launcher still opens the app
    When the IntelliJ "Open browser" step runs
    Then it opens http://localhost:3000/library (the landing page would otherwise be the first thing seen in dev)

  # Hero: one clear promise, one primary action, language up front
  Scenario: The hero states the promise and the primary call to action
    When I open /
    Then the page has a single h1 about learning a language from content you enjoy
    And a primary "Start reading free" button links to /signup
    And under it a reassurance line says the free plan needs no credit card

  Scenario: Picking a language in the hero starts sign-up for that language
    When I click "Français" in the hero's "I want to learn" picker
    Then I go to /signup?lang=fr

  Scenario: Every supported language is offered
    Then the hero picker lists all 8 languages (Español, Français, Deutsch, Italiano, Português, 日本語, 中文, 한국어)

  # Try the reader before signing up
  Scenario: Clicking a word in the demo shows its meaning
    Given the demo shows a Spanish sample sentence with unknown words highlighted blue
    When I click a highlighted word
    Then a definition card shows the word, its meaning and its status buttons
    And the word becomes "learning" (yellow), as it would in the real reader

  Scenario: Marking words known in the demo grows the known-word count
    Given the demo's known-word counter shows N
    When I click a word and choose "Known"
    Then the word loses its highlight and the counter shows N + 1
    When I choose "Known" for the same word again
    Then the counter stays N + 1

  Scenario: Switching the demo language
    When I pick "日本語" in the demo's language tabs
    Then the sample text is Japanese, no word is selected, and the counter is reset for that sample
    And the demo's sign-up nudge links to /signup?lang=ja

  Scenario: The demo nudges toward sign-up once the visitor has engaged
    Given I have not clicked any word in the demo
    Then the demo shows a hint to click a word
    When I have looked up at least one word
    Then the demo shows "Save these words — create a free account" linking to /signup?lang=<demo language>

  Scenario: The demo works from the keyboard
    When I Tab to a demo word and press Enter
    Then its definition card opens, the same as clicking

  # Answering objections
  Scenario: Pricing states the real free-plan limits
    Then the pricing section shows Free with 5 imported texts and 500 saved words, Pro and Classroom
    And each plan has a button: Free and Pro link to /signup, Classroom links to /signup too

  Scenario: Frequently asked questions open and close
    When I click the question "Do I need to be a beginner / an advanced learner?"
    Then its answer is shown
    When I click it again
    Then its answer is hidden

  # Repeated, consistent calls to action
  Scenario: The page ends with a final call to action
    When I scroll to the end of the page
    Then a closing section repeats the language picker and the "Start reading free" button
    And every sign-up link on the page goes to /signup (optionally with ?lang=<code> for a supported language)

  # Carrying the chosen language through sign-up
  Scenario: Sign-up keeps the chosen language
    Given I opened /signup?lang=de
    When I create an account
    Then I land on /onboarding?lang=de

  Scenario: Sign-up ignores an unsupported language
    Given I opened /signup?lang=xx
    When I create an account
    Then I land on /onboarding with no language

  Scenario: Onboarding starts with the chosen language
    Given I am signed in and open /onboarding?lang=de
    Then Deutsch is already selected, and step 2 ("Pick something to read") lists German starter texts
    And my target language has been set to German

  Scenario: Onboarding without a usable language asks as before
    When I open /onboarding or /onboarding?lang=xx
    Then step 1 "What are you learning?" is shown with no language selected

  # Look and feel
  Scenario: The page follows the site's theme and works on phones
    Then it uses the theme tokens only (no dark: variant, no raw palette colours), in light and dark
    And at 390px wide nothing overflows horizontally and the primary CTA is visible without scrolling
