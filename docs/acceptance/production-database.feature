Feature: Production's database (docs/production.md, phase 1)
  Production keeps paying users' data, so its database must survive a broken machine, a lost availability zone and a
  bad change, and we must know a backup actually restores. The database is defined once in CDK with two settings: the
  small, cheap ones it runs on today and the safe ones. (October 2026: the stack built as staging became production,
  in the same AWS account. It keeps the small settings while it has no users and switches to the safe ones before the
  beta; "staging" in the scenarios below means those small settings.)

  # --- Production's settings (synthesized and tested without AWS access) ---

  Scenario: Production's database runs in two availability zones
    Given the production database settings
    Then RDS keeps a standby copy in a second availability zone and fails over to it by itself

  Scenario: Production keeps two weeks of backups and can restore to any moment in them
    Then automatic backups are kept 14 days, so the database can be restored to any second in that window
      (point-in-time restore)
    And backups and snapshots carry the database's tags

  Scenario: Production's database can't be deleted by accident
    Then deletion protection is on, so neither a stack change nor a console click can delete it
    And if its stack is ever deleted, the database is kept, not removed

  Scenario: Production's database is private and encrypted, like staging's
    Then it is not publicly accessible, lives in subnets with no internet route, and its storage is encrypted
    And its credentials are generated in Secrets Manager

  Scenario: Production's storage grows by itself
    Then storage starts at 20 GB and grows automatically up to 100 GB, so a full disk doesn't stop the app

  # --- Staging is unchanged ---

  Scenario: Staging's database stays as it is
    Given staging's database is now defined by the same code
    Then its deployed definition is unchanged: one availability zone, the smallest instance, 1 day of backups, a final
      snapshot if it is removed
    So that the next deploy of staging changes nothing about its database

  # --- The restore rehearsal (before launch, on production) ---

  Scenario: A restore is rehearsed once before launch
    Given production holds data
    When the team restores production's database to a moment a few minutes ago, as a new database, following
      docs/runbooks/restore-database.md
    Then the restored copy has the data written before that moment
    And the time it took is written down, as the expected recovery time
    And the copy is deleted afterwards, so it costs nothing more
