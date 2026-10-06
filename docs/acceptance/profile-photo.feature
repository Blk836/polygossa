Feature: Profile photo
  Learners can upload a photo of themselves on Settings › Profile. It replaces the initial in the
  account menu button. Every plan has it, Free included.

  The browser crops the picked image to a centred square and shrinks it to 256×256 before uploading.
  Re-drawing the image also strips its metadata, such as the GPS location phones store in photos.
  The server still checks every upload itself and never trusts the browser.

  Background:
    Given I am signed in
    And I am on Settings › Profile

  # --- Showing the photo ---

  Scenario: No photo yet
    Given I have never uploaded a photo
    Then the Profile page shows a round placeholder with my initial and an "Upload photo" button
    And there is no "Remove photo" button
    And the account menu button shows my initial

  Scenario: Uploading a photo
    When I click "Upload photo" and pick a JPEG of myself
    Then the Profile page shows my photo in a circle
    And the account menu button shows the same photo, without reloading the page
    And the button now reads "Change photo" and a "Remove photo" button appears

  Scenario: The photo stays after reloading and signing in again
    Given I have uploaded a photo
    When I reload the page, or sign out and back in
    Then the account menu button and the Profile page still show my photo

  Scenario Outline: Accepted image formats
    When I pick a <format> image
    Then it is uploaded and shown as my photo

    Examples:
      | format |
      | JPEG   |
      | PNG    |
      | WebP   |

  Scenario: A non-square photo is cropped, not squashed
    When I pick a 1200×800 landscape photo
    Then the stored photo is 256×256, cut from the centre of the image
    And faces in it are not stretched

  Scenario: Location data is removed
    Given a JPEG that carries GPS coordinates in its metadata
    When I upload it
    Then the stored photo has no GPS or other metadata

  Scenario: Changing the photo
    Given I have uploaded a photo
    When I click "Change photo" and pick a different image
    Then the new photo is shown everywhere
    And the old photo file is deleted from the server

  Scenario: Removing the photo
    Given I have uploaded a photo
    When I click "Remove photo"
    Then the Profile page and the account menu button show my initial again
    And the photo file is deleted from the server
    And reloading still shows my initial

  Scenario: The photo upload doesn't need the Save button
    Given I have typed a new name but not clicked Save
    When I upload a photo
    Then the photo is saved straight away
    And my unsaved name is still in the Name field, still unsaved

  # --- Failure paths ---

  Scenario: Picking a file that isn't an image
    When I pick a PDF or text file
    Then I see "Please choose a JPEG, PNG or WebP image"
    And my current photo (or initial) is unchanged
    And nothing is uploaded

  Scenario: Picking an image the browser can't read
    When I pick a file named photo.jpg that is actually corrupt
    Then I see "That image couldn't be read. Try another one."
    And my current photo is unchanged

  Scenario: Picking a huge file
    When I pick an image larger than 20 MB
    Then I see "That image is too large (max 20 MB)"
    And nothing is uploaded

  Scenario: The upload fails
    Given the server rejects or can't be reached for the upload
    When I pick a valid image
    Then I see an error message next to the photo
    And my previous photo (or initial) is still shown
    And the "Upload photo" button works again

  Scenario: Remove fails
    Given the server can't be reached
    When I click "Remove photo"
    Then I see an error message
    And my photo is still shown

  Scenario: While uploading
    When I pick a valid image
    Then the button reads "Uploading…" and is disabled until the upload finishes

  # --- Server-side checks (the API, not the page) ---

  Scenario: The server checks the file's real content
    When a file whose content isn't a PNG or JPEG is uploaded as a photo, whatever its name or declared type
    Then the server answers 400 "Please upload a JPEG or PNG image"
    And nothing is stored and my current photo is unchanged

  Scenario: The server limits size
    When an upload over 1 MB is sent straight to the API
    Then the server answers 400 and stores nothing

  Scenario: An empty upload
    When an empty file is uploaded
    Then the server answers 400 and stores nothing

  # --- Privacy and access ---

  Scenario: Photos are only served to signed-in users through the app
    Given I am signed out
    When I request a user's photo
    Then I am refused

  Scenario: Another user's photo address can't be guessed into a file path
    When a photo is requested with a name like "../../application.yml"
    Then the server answers 404

  # Account deletion doesn't exist yet. When the GDPR work in docs/production.md adds it, deleting an
  # account must delete the photo file too; that gets noted there rather than tested here.

  # --- Layout ---

  Scenario: Phone width
    Given a 390px-wide viewport
    Then the photo, "Change photo" and "Remove photo" fit on Profile
    And the page doesn't scroll sideways

  Scenario: Dark mode
    Given the dark theme
    Then the placeholder circle and buttons use theme colours with readable contrast
