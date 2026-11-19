---
description: Agent Toolkit 工作区规则，任务开始时自动校验设置并驱动 Orchestrator 工作流
alwaysApply: true
---

# Agent Toolkit Workspace Rules

## Initialization preflight

At the start of every workspace task, automatically inspect `.agent-toolkit/settings.json` and validate it against `.agent-toolkit/settings.schema.json` before ordinary feature development. This check is automatic; the user does not need to invoke an Init command, skill, or agent explicitly.

- If the settings file is missing or has `"initialized": false`, run initialization before continuing with the ordinary task: use the `agent-toolkit-init` skill, which GitHub Copilot and TRAE also expose as the `Agent Toolkit Init` agent.
- If the JSON is malformed or fails schema validation, stop and report the exact validation error. Do not start feature work or silently substitute defaults.
- Once initialized and valid, follow the saved workflow, language, and Git permissions.

## Hard gate — no file changes before orchestrator

**This is the highest-priority rule in this file.** It is not a suggestion; it is a gate that precedes every tool call that mutates the workspace.

**Before invoking any of the following tools** on a user-initiated workspace task:
- `Write`, `Edit`, `DeleteFile`, `Glob` (only when planning to mutate matched paths)
- Task delegation that will produce or modify files

**you MUST first call `agent-toolkit-orchestrator`** (or `agent-toolkit-init` when the initialization preflight above requires it).

Concretely:
1. Receive a user task.
2. Run the initialization preflight (settings.json valid?).
3. If initialized: call `agent-toolkit-orchestrator` skill. Do not skip it regardless of task size, apparent simplicity, or whether you think you already know what to do.
4. Wait for orchestrator to return its plan / coder assignment / review gates.
5. **Only then** invoke file-mutating tools.

**No exceptions.** "This task is small enough to skip the tool" is a judgment call that has been demonstrated to fail in practice; do not make it again. The only valid reason to skip orchestrator is when the task itself is to run a Git command or read-only inspection that produces zero file output.

If you find yourself about to call `Write` or `Edit` without having called orchestrator first, **stop** — back up — and call it.

---

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
