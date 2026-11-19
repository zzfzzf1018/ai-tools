---
description: 'Run the Agent Toolkit Orchestrator workflow for the current task, using saved settings and numbered requirement records.'
---

# Agent Toolkit Orchestrator

Run the `agent-toolkit-orchestrator` skill for this task. Do not replace its procedure with an ad-hoc workflow.

1. Validate `.agent-toolkit/settings.json` against `.agent-toolkit/settings.schema.json` before feature work; stop on a validation error.
2. Create the next numbered requirement record in `docs/people-requirements-record/` before implementation, then derive the shared task ID from its numeric prefix.
3. Require the linked REQ, PLAN, DESIGN, and final TASK documents with that same ID and slug.
4. Follow the configured workflow, reviewer policy, and Git permissions. Never commit, push, tag, create a pull request, or publish a release unless the corresponding setting explicitly allows it.

Treat `docs/agent-toolkit.md` at the project root as the toolkit guide. Change the canonical source under `.github/` rather than a host-specific generated copy.
