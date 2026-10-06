Feature: Profile photo
  Learners can upload a photo of themselves on Settings › Profile, crop it, and see it wherever their
  name appears in the app. People without a photo show a round initial instead. Every plan has it,
  Free included.

  After picking an image, a crop dialog lets the learner move and zoom it inside a circle. The browser
  then cuts out that square and shrinks it to 256×256 before uploading. Re-drawing the image also strips
  its metadata, such as the GPS location phones store in photos. The server still checks every upload
  itself and never trusts the browser.

  Background:
    Given I am signed in
    And I am on Settings › Profile

  # --- Showing the photo on Profile ---

  Scenario: No photo yet
    Given I have never uploaded a photo
    Then the Profile page shows a round placeholder with my initial and an "Upload photo" button
    And there is no "Remove photo" button
    And the account menu button shows my initial

  Scenario: Uploading a photo
    When I click "Upload photo", pick a JPEG of myself and click "Save photo" in the crop dialog
    Then the Profile page shows my photo in a circle
    And the account menu button shows the same photo, without reloading the page
    And the button now reads "Change photo" and a "Remove photo" button appears

  Scenario: The photo stays after reloading and signing in again
    Given I have uploaded a photo
    When I reload the page, or sign out and back in
    Then the account menu button and the Profile page still show my photo

  Scenario Outline: Accepted image formats
    When I pick a <format> image and save it
    Then it is uploaded and shown as my photo

    Examples:
      | format |
      | JPEG   |
      | PNG    |
      | WebP   |

  Scenario: Location data is removed
    Given a JPEG that carries GPS coordinates in its metadata
    When I upload it
    Then the stored photo has no GPS or other metadata

  Scenario: Changing the photo
    Given I have uploaded a photo
    When I click "Change photo", pick a different image and save it
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

  # --- Cropping ---

  Scenario: The crop dialog opens on the picked image
    When I pick an image
    Then a "Crop your photo" dialog shows it behind a round frame
    And the image starts centred and just big enough to fill the frame, so nothing is stretched
    And nothing is uploaded yet

  Scenario: Moving the image
    Given the crop dialog shows a landscape photo
    When I drag the image sideways
    Then a different part of it sits in the frame
    And the saved photo is exactly what was inside the frame

  Scenario: Zooming
    When I move the zoom slider up
    Then the image grows around the centre of the frame
    And the saved photo shows the zoomed-in part

  Scenario: The image always fills the frame
    When I drag the image far past an edge, or zoom out as far as the slider goes
    Then the image stops at the frame's edge and never leaves an empty gap inside the frame

  Scenario: Cropping with the keyboard
    Given the image in the crop dialog has focus
    When I press the arrow keys, or "+" and "-"
    Then the image moves, or zooms in and out, the same as dragging and the slider

  Scenario: Cancelling the crop
    When I click "Cancel" or press Escape in the crop dialog
    Then the dialog closes and nothing is uploaded
    And my current photo (or initial) is unchanged

  Scenario: Choosing the same file again after cancelling
    Given I cancelled the crop dialog
    When I pick the same file again
    Then the crop dialog opens again

  Scenario: Phone width crop
    Given a 390px-wide viewport
    When the crop dialog is open
    Then the frame, slider and buttons fit on screen
    And I can drag the image with my finger

  # --- Shown wherever a name appears ---

  Scenario Outline: Photos next to people's names
    Given "Ana" has uploaded a photo and "Ben" has not
    When I see <place>
    Then Ana's name has her photo beside it
    And Ben's name has a round initial "B" beside it

    Examples:
      | place                                                         |
      | the account menu button and the open account menu            |
      | the author of a forum thread in the thread list              |
      | the author of each forum post                                 |
      | a student in my class's roster                                |
      | a student in my class's progress table                        |
      | the "by …" line on a shared text's card in Explore            |
      | the "shared by …" line in the reader                          |
      | the "by …" line on a shared playlist's card, header and pane  |

  Scenario: Someone else changes their photo
    Given Ana changes her photo
    When I next load a page showing her name
    Then I see her new photo, not a cached old one

  Scenario: A photo that fails to load
    Given a person's photo can't be loaded
    Then their round initial is shown instead of a broken image

  # --- Failure paths ---

  Scenario: Picking a file that isn't an image
    When I pick a PDF or text file
    Then I see "Please choose a JPEG, PNG or WebP image"
    And no crop dialog opens and nothing is uploaded

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
    When I click "Save photo" in the crop dialog
    Then the dialog stays open with an error message
    And "Save photo" works again so I can retry, or I can cancel
    And my previous photo (or initial) is still shown

  Scenario: Remove fails
    Given the server can't be reached
    When I click "Remove photo"
    Then I see an error message
    And my photo is still shown

  Scenario: While uploading
    When I click "Save photo"
    Then it reads "Saving…" and is disabled until the upload finishes

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

  Scenario: Photos are only served to signed-in users
    Given I am signed out
    When I request a user's photo
    Then I am refused

  Scenario: Asking for a photo that isn't there
    When I request the photo of a user who has none, or of a user who doesn't exist
    Then the server answers 404

  # Account deletion doesn't exist yet. When the GDPR work in docs/production.md adds it, deleting an
  # account must delete the photo file too; that is noted there rather than tested here.

  # --- Layout ---

  Scenario: Phone width
    Given a 390px-wide viewport
    Then the photo, "Change photo" and "Remove photo" fit on Profile
    And the page doesn't scroll sideways

  Scenario: Dark mode
    Given the dark theme
    Then the placeholder circle, crop dialog and buttons use theme colours with readable contrast
