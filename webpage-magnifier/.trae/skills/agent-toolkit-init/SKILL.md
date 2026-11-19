---
name: agent-toolkit-init
description: 'Initialize or update Agent Toolkit project settings. Use on first run, when settings are uninitialized, or when the user asks to change workflow, Git, release, or language preferences.'
---

# Initialize Agent Toolkit

This skill provides the procedure used by the user-facing `Agent Toolkit Init` agent.

## Procedure

1. Read `.agent-toolkit/settings.schema.json`, `.agent-toolkit/settings.json` if present, and the repository's current remotes and workflow files. Do not expose remote credentials. This Init flow is invoked automatically before ordinary feature work if settings are missing or `initialized` is `false`; explicit user invocation is not required.
2. Ask the user about each applicable setting and explain that Git or release side effects remain disabled unless explicitly enabled:
   - Development workflow: single-branch, Git Flow, or GitHub Flow. GitHub Flow allows direct work on `main` and optional short-lived branches from `main` with user-created PRs; do not automatically create branches or PRs.
   - Whether to automatically commit, push, and create tags; ask separately for each.
   - For Git Flow, whether to create feature branches from `develop` (`gitFlow.featureBranchFromDevelop`) and whether to create feature PRs automatically (`gitFlow.createPullRequestAutomatically`). Feature PRs are separate from sealing PRs; automatic PR creation requires `gitAutomation.autoPush: true`.
   - For Git Flow sealing, the source/target branches, whether to create a PR, merge strategy, and whether to tag after merge. Explain that a sealing PR requires `autoPush`, post-merge tagging requires `autoTag`, and if `tagAfterMerge` is enabled the target must be `main`; tags may only be created from `main`. Git Flow fields are inactive in GitHub Flow; preserve them when changing modes. Do not assume a project-specific branch or merge policy.
   - The Reviewer policy: `on-requested-sealing-or-release-tag` (safe default when missing from an existing schema-v1 file), `every-task`, or `never`. Ask the user to choose; save the selected value as `reviewerPolicy`.
   - Whether to use GitVersion; record the configured baseline and optional `v` tag prefix where applicable.
   - For GitHub repositories, whether to create an automatic-release GitHub Actions workflow.
   - For Azure DevOps repositories, whether to create an automatic-release Azure Pipeline.
   - Documentation and code-comment language: Chinese, English, or bilingual.
   - Additional free-form requirements and optional future settings.
3. Ask only applicable platform questions, but ask about both platforms if the repository uses both. If the project type or release trigger/artifact is unclear, record the preference and ask for the missing project-specific details before generating a release workflow.
4. Write the answers to `.agent-toolkit/settings.json`, preserving unrelated existing settings, `additionalRequirements`, and `customSettings`, then validate the result against the schema. In Git Flow, if automatic pushing is disabled, set `gitFlow.createPullRequestAutomatically` and, when present, `gitFlow.sealing.createPullRequest` to `false`; if automatic tagging is disabled, set `gitFlow.sealing.tagAfterMerge` to `false` when present. In GitHub Flow preserve inactive legacy fields without inferring permissions from them. New structured policy fields are optional so existing schema-v1 settings without them remain valid; if `reviewerPolicy` is absent, use conditional review only for explicitly requested sealing or release-tag work.
5. Never infer consent from existing workflows or defaults. Git side effects require explicit user intent and applicable permissions. Do not create release automation, Git branches, commits, pushes, tags, or pull requests during initialization unless the user explicitly requested that action and the needed project details are known.
6. Create a numbered requirement record for the onboarding request and answers under `docs/people-requirements-record/`. Redact secrets and sensitive personal information; do not record hidden reasoning.
7. Summarize the saved settings and any deferred actions. Do not claim workflows were created if only preferences were saved.

## Safety and errors

- Use `.agent-toolkit/settings.template.json` as the initial structure when settings do not exist.
- If settings are malformed or conflict with the schema, report the exact issue and stop ordinary feature work; do not guess, silently repair, or substitute defaults.
- Do not store credentials, tokens, private keys, or sensitive personal information in settings or requirement records.
- In Git Flow, `gitFlow.createPullRequestAutomatically` and `gitFlow.sealing.createPullRequest` require `gitAutomation.autoPush` to be `true`.
- In Git Flow, `gitFlow.sealing.tagAfterMerge` requires `gitAutomation.autoTag` to be `true`, and its target branch must be `main`.
- Tags may only be created from `gitAutomation.tagSourceBranch` (`main`).
