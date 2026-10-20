Feature: A class's student count reads in the right number (#186)

  Scenario Outline: The count on Classes and on the class page
    Given a teacher's Spanish class with <n> students
    Then the Classes list and the class page say "Spanish · <text>"

    Examples:
      | n | text       |
      | 0 | 0 students |
      | 1 | 1 student  |
      | 2 | 2 students |
