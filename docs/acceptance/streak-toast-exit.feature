Feature: The streak message leaves gently (#154)

  Background:
    Given I have just kept my streak and a cheering Polly says "3-day streak kept"

  Scenario: Closing it plays the exit before it goes
    When I press Close
    Then Polly buzzes up and off the card
    And the card slides down a little, shrinks slightly and fades out
    And once the exit has played the message is gone from the page
    And it can't be clicked while it leaves

  Scenario: Timing out plays the same exit
    When I leave it alone for a few seconds
    Then it leaves with the same exit as when closed

  Scenario: Pointing at it keeps it
    When I hold the pointer over the message
    Then it stays for as long as I do
    And when I move away it leaves by itself a few seconds later

  Scenario: Reduced motion
    Given my system asks for reduced motion
    When the message leaves
    Then it only fades out, quickly, with no hop or slide
    And then it is gone from the page
