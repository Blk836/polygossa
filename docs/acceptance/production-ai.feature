Feature: AI features on in production (docs/production.md)
  Production had no OpenAI key, so writing feedback, AI definitions and Explore's AI recommendations were off there,
  though they work locally. Production gets the key the safe way: kept only in Secrets Manager and handed to the
  backend when it starts.

  Scenario: Production's backend has the OpenAI key
    Given the Secrets Manager entry "polygossa/openai-api-key" holds the key
    When production deploys
    Then the backend starts with OPENAI_API_KEY from that entry, and AI features work as they do locally
    And the key is never in the code, the CloudFormation template, the container's plain settings or the frontend

  Scenario: The usual limits still apply
    Then each learner's daily AI limit, the plan gating and the rules about what is sent stay as they are
    And the privacy policy says the AI features send the text involved to OpenAI (never the learner's vocabulary)

  Scenario: The background job starts on production
    Given the key is set
    Then the background job tags and embeds public texts for Explore's recommendations, as it does locally
