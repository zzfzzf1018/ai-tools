---
mode: agent
description: 'Initialize or update Agent Toolkit project settings through the agent-toolkit-init skill.'
tools: [read, search, edit]
---

# Agent Toolkit Init

Run the `agent-toolkit-init` skill for this project. Do not invent or copy workflow preferences from another repository.

1. Read `.agent-toolkit/settings.schema.json` and `.agent-toolkit/settings.json` if it exists.
2. Ask the user for every applicable workflow choice, including `developmentWorkflow`, Git automation, language, and `reviewerPolicy`.
3. Validate the resulting settings against the schema before writing them; report any validation error instead of saving an invalid file.
4. Never print remote credentials, tokens, secrets, or sensitive personal information.

Initialization is normally automatic when settings are missing or `"initialized": false`. Use this command for an explicit first run or a deliberate preference change.
