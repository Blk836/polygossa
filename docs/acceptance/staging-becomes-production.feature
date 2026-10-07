Feature: Staging becomes production (decided October 2026, docs/production.md "Decisions")
  The AWS stack built as staging becomes production, in the same AWS account, keeping its address, database and
  data. Local runs become the QA environment. Merges keep deploying it automatically. Only names and labels change;
  nothing is rebuilt.

  # --- Nothing is rebuilt ---

  Scenario: The relabel replaces no resource
    Given production's stack as deployed today (CloudFormation stack PolygossaStaging)
    When the relabelled code is deployed
    Then no resource is replaced or removed: the database, load balancer, containers and CloudFront distribution stay
    And the site keeps its address (https://d3pd9mue4v7won.cloudfront.net) and every account and text on it
    And `cdk diff` shows only tag and description changes before the merge

  Scenario: The stack keeps its CloudFormation name
    Then the stack is still deployed as PolygossaStaging, because renaming a stack in CloudFormation creates a new one
      and deletes the old one with its database
    And its description says it is production

  # --- What is relabelled ---

  Scenario: Production's resources are tagged as production
    Then every resource in the stack carries `environment: production` instead of `environment: staging`
    So that AWS's cost reports show production's spending under that name

  Scenario: The deploy job is called what it does
    When a pull request is merged to main
    Then the CI job that deploys is named "deploy production", and it still deploys only after every check passed
    And the temporary hand-started deploy without checks (`deploy_only`) still works until phase 8 removes it

  Scenario: The code names production
    Then the stack's code is the production stack, and the two database settings are named "small" (today's) and
      "safe" (before the beta), instead of "staging" and "production"
    And its tests still prove the database stays on the small settings for now

  # --- Unchanged ---

  Scenario: Production stays small until the beta
    Then the database, the containers and their sizes are exactly as they were as staging (one zone, one copy each)

  Scenario: QA has no cloud stack yet
    Then local runs need nothing new in AWS today
    And phase 3 adds the QA Cognito user pool, as its own small stack in the same account
