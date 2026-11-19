# Agent Toolkit Workspace Rules

## Initialization preflight

At the start of every workspace task, automatically inspect `.agent-toolkit/settings.json` and validate it against `.agent-toolkit/settings.schema.json` before ordinary feature development. This check is automatic; the user does not need to invoke an Init command, skill, or agent explicitly.

- If the settings file is missing or has `"initialized": false`, run initialization before continuing with the ordinary task: use the `agent-toolkit-init` skill, which GitHub Copilot and TRAE also expose as the `Agent Toolkit Init` agent.
- If the JSON is malformed or fails schema validation, stop and report the exact validation error. Do not start feature work or silently substitute defaults.
- Once initialized and valid, follow the saved workflow, language, and Git permissions.

This toolkit is installed for several agent hosts from one canonical source. The same rules and skills are published to `.github/` for GitHub Copilot, to `AGENTS.md` and `.codebuddy/rules/` for WorkBuddy, and to `.trae/` for TRAE. Treat `docs/agent-toolkit.md` at the project root as the toolkit guide, and change the canonical source instead of editing a single host's generated copy.

Use the `agent-toolkit-orchestrator` skill for every user task. All agents and skills must honor the saved settings; see the toolkit guide at `docs/agent-toolkit.md`.

Drive workflow behavior from `.agent-toolkit/settings.json`, not repository-specific assumptions:

- `developmentWorkflow` selects single-branch, Git Flow, or GitHub Flow. GitHub Flow permits direct work on `main` or optional short-lived branches from `main` with user-created PRs; do not automatically create branches or PRs. For Git Flow, follow `gitFlow.featureBranchFromDevelop` and `gitFlow.createPullRequestAutomatically`; an automatically created pull request requires `gitAutomation.autoPush`.
- In Git Flow only, `gitFlow.sealing`, when present, supplies the sealing source/target branches, pull-request choice, merge strategy, and post-merge tagging choice. These legacy fields are inactive in GitHub Flow. A sealing pull request requires `autoPush`; `tagAfterMerge` requires `autoTag`. Tags may only be created from `gitAutomation.tagSourceBranch`, which is restricted to `main`; use `main` as the safe source if this optional field is absent from a legacy settings file.
- Check `gitAutomation.autoCommit`, `autoPush`, and `autoTag` before those side effects. Never infer permissions or fill missing optional workflow settings with this repository's policy; ask or stop if a requested action lacks configuration.
- `reviewerPolicy` controls independent review: `every-task`, `never`, or `on-requested-sealing-or-release-tag`. If omitted from an existing schema-v1 settings file, use the last option: review only explicitly requested sealing or release-tag work.
- For explicitly requested Git Flow sealing, use the configured merge strategy, not a repository-specific assumption.
- The Orchestrator passes the numbered requirement-record ID to the Coder. Require the Coder's shared-ID Requirements Specification, Execution Plan, Software Design Specification, and final Task document as described in the toolkit guide; verify linked task documentation at closure.

Never perform commits, pushes, tags, pull-request creation, or release publication without both explicit user intent and any applicable setting permission. Before creating a tag, verify it does not already exist. Redact secrets and sensitive personal information from requirement records.
