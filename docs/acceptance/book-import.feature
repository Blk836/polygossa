Feature: Import an e-book or a PDF (see docs/architecture/library-and-explore.md)
  EPUB and PDF are how intermediate learners bring in novels. A book becomes one text per chapter, in order, gathered
  in a new playlist named after the book, so the reader's previous/next links walk through it like LingQ's courses.
  Books stay private: most are copyrighted, so they can't be shared from the import form.

  Background:
    Given I am signed in on Pro

  # --- EPUB ---

  Scenario: An EPUB becomes one text per chapter, in a playlist
    Given an EPUB titled "El viaje" whose spine holds a cover page, chapters "Uno" and "Dos", in that order
    When I import it in Spanish from Import › Book
    Then a private playlist "El viaje" holds two private texts, "Uno" and "Dos", in spine order
    And each text keeps the chapter's paragraphs as paragraphs
    And the cover page (no text) is skipped
    And I land on the first chapter

  Scenario: Chapter titles
    Then a chapter is titled by its first heading, else its document title, else "Part N"

  Scenario: A very long chapter is split
    Given a chapter longer than the 100,000 characters a text holds
    Then it becomes "<title> (1)", "<title> (2)", … each cut at a paragraph boundary

  Scenario: Script and style are not text
    Then script and style elements, and markup, never end up in the text

  # --- PDF ---

  Scenario: A PDF with an outline is split at its chapters
    Given a PDF whose outline (bookmarks) has top-level entries "Capítulo 1" and "Capítulo 2"
    When I import it
    Then each top-level entry becomes a text with that title, holding its pages

  Scenario: A PDF without an outline is split into parts
    Given a PDF with no outline
    Then its text is cut into parts of about 20,000 characters at paragraph boundaries, titled "Part 1", "Part 2", …
    And the playlist is named after the PDF's title, else the file name

  # --- Failures and limits ---

  Scenario Outline: Files that can't be imported
    When I upload <file>
    Then I get 400 with "<message>" and nothing is created

    Examples:
      | file                                    | message                                        |
      | a file that is neither EPUB nor PDF     | Upload an EPUB or a PDF                        |
      | a broken EPUB (no container.xml)        | This EPUB could not be read                    |
      | a PDF of scanned pages (no text layer)  | This PDF has no text to read                   |
      | an EPUB with more than 300 chapters     | at most 300 chapters                           |

  Scenario: The free plan's text limit
    Given I am on the free plan with 3 of my 5 texts used
    When I import a book of 4 chapters
    Then I get 402 saying the book needs 4 texts and 2 are left, and nothing is created

  Scenario: Imports are private
    Then the import form has no "Share" box for books, and every text and the playlist are private
