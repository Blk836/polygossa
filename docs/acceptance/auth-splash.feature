Feature: Sign-in and sign-up splash — "a page that learns"
  The sign-in and create-account pages were a bare form. Beside the form now sits a living page of text that plays out
  what the product does: a sentence in a language you could learn, mostly blue (new) words. One by one a word is
  "tapped": its meaning pops up in a little gloss, it turns yellow (learning), and a moment later it settles into plain
  ink (known). A counter shows how much of the page you can read. When every word is known the page turns, like a book,
  to the same idea in the next language. Behind it, "hello" drifts by faintly in many languages and scripts.
  It reuses the landing page's demo sentences (one per learnable language, every word glossed), so nothing is invented,
  and it uses the reader's own word colours, so the first thing a newcomer sees is how reading here actually looks.

  Background:
    Given I am a signed-out visitor

  # Where it appears
  Scenario Outline: Both auth pages show the splash beside the form
    When I open <page>
    Then I see the form headed "<heading>" as before, and it still works as before
    And beside it, a splash panel with a short line of copy and a sentence of highlighted words

    Examples:
      | page    | heading                       |
      | /login  | Welcome back                  |
      | /signup | Start reading in two minutes  |

  Scenario: Wide screens split the page; phones stack it
    When I open /login on a screen at least 1024px wide
    Then the splash fills one half of the screen and the form the other, side by side
    When I open /login on a phone-width screen (390px)
    Then the splash is a short band above the form, the form needs no sideways scrolling,
    And the email field is visible without scrolling

  Scenario: The splash copy fits the page
    When I open /login
    Then the splash says "Pick up where you left off"
    When I open /signup
    Then the splash says "Every word you learn makes the next page easier"

  # What it plays
  Scenario: Words are learned one at a time
    Given the splash shows a sentence where some words are new (blue) and the rest already known (plain)
    When the animation runs
    Then one new word at a time shows its meaning in a gloss (e.g. "marché — market"), then turns yellow (learning),
    And then becomes plain (known) while the next new word is tapped
    And the counter "words known" goes up by one each time, ending at every word in the sentence

  Scenario: The page turns to the next language
    When every word in the sentence is known
    Then after a short pause the page turns and shows the next language's sentence, with its new words blue again
    And the language's own name is shown on the page (e.g. "Français")
    And after the last of the six learnable languages it starts again from the first

  Scenario: Sign-up starts in the language I picked on the landing page
    When I open /signup?lang=fr
    Then the first sentence the splash shows is the French one
    When I open /signup?lang=xx or /signup with no language
    Then the first sentence is the English one

  Scenario: Only learnable languages appear
    Then the splash never shows Japanese, Chinese or Korean sentences (paused for learning)

  # Control, accessibility, honesty
  Scenario: Visitors can pause and resume it
    When I press the splash's "Pause animation" button
    Then the words stop changing and the button reads "Play animation"
    When I press it again
    Then it continues from where it stopped

  Scenario: Reduced motion shows a still page
    Given my system asks for reduced motion
    When I open /login
    Then the splash shows one sentence with its new words blue, nothing moves, and the drifting greetings are still
    And no pause button is shown

  Scenario: The splash never gets in the way of signing in
    Then the splash is decorative to screen readers except for its copy line (the sentence is not read out word by word)
    And keyboard focus goes from the logo straight to the form fields, not into the splash (apart from its pause button)
    And the splash never covers the form, in light or dark theme

  Scenario: It uses the theme's colours
    Then the splash's words use the reader's new / learning / known colours, and its background the theme's tokens
    And it looks right in both light and dark theme (the palette contrast test covers any new colour token)

  # Getting to the pages in development
  Scenario: The auth pages are visible in development, like the landing page
    Given development auto-login is on
    When a signed-out visitor opens /login or /signup
    Then the page is shown, not skipped by auto-login into the library
    And every other app page still signs in automatically as before
    And a signed-in visitor opening /login or /signup is still sent to the library
