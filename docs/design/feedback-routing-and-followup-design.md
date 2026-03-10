# Feedback Routing and Follow-up Design (Post-PR #403)

## Status
This document captures the architecture and delivery plan agreed after PR #403 discussions.

- Current PR (#403 / issue #399) remains scoped to structured feedback tools + validation + dedupe + persistence.
- Follow-up work adds configurable routing to SCM, issue/PR/fork decisioning, and orchestrator execution behavior.

## Goals
1. Support configurable feedback destination per project.
2. Decide deterministically whether to:
   - file issue only,
   - file issue + PR reference,
   - file issue + fork reference.
3. Keep execution reliable, idempotent, and auditable.
4. Keep architecture pluggable for GitHub and GitLab.

## Explicit Decisions
1. **Routing mode is exclusive**: `local` OR `scm` (no `both`).
2. **Privacy guardrails are deferred** to a dedicated follow-up PR.
3. **Decision intelligence can be agent-assisted**, but all side effects are executed by deterministic orchestrator code.
4. **No hidden dual persistence in `scm` mode**. Only minimal publish journal metadata is stored for retries/idempotency.

## Non-Goals (for this follow-up)
1. Full privacy/redaction engine.
2. Generic "spawn arbitrary subagents for every decision" pattern.
3. Replacing existing lifecycle architecture.

## High-Level Flow
1. A report is captured (`bug_report` or `improvement_suggestion`).
2. Orchestrator resolves routing mode:
   - `local`: persist locally and stop.
   - `scm`: publish via provider adapter.
3. In `scm` mode, orchestrator decides outcome based on policy + context:
   - issue only,
   - issue + PR reference,
   - issue + fork reference.
4. Orchestrator updates publish journal with status and links.

## Decision Model (Simple Rules)
Primary intent signal:
- `self_blocking_now = true`: user needs this now; escalate to actionable path.
- `self_blocking_now = false`: report only.

Operational decisions:
1. If not self-blocking -> issue only.
2. If self-blocking and branch/commits are ready in upstream -> issue + PR reference.
3. If self-blocking and upstream write unavailable -> issue + fork reference (and PR-from-fork reference if available).

## Orchestrator vs Subagent Responsibilities
### Deterministic orchestrator control plane (required)
Responsible for:
1. Find existing issue by `dedupeKey` marker.
2. Decide create vs comment.
3. Resolve repo target (upstream/fork) from policy + context.
4. Ensure fork if needed.
5. Create/update issue and PR references.
6. Retry/idempotency/journal updates.

### Ephemeral subagent skill (optional)
Responsible for recommendation only:
1. classify urgency (`self_blocking_now`),
2. suggest action (`issue_only`, `issue_and_pr`, `issue_and_fork`),
3. emit strict JSON decision object.

Constraint:
- Subagent does not call SCM side-effect APIs directly.
- Orchestrator executes all side effects.

## Proposed Components
1. `FeedbackRouter`
   - Chooses `local` vs `scm` path.
2. `FeedbackDecisionEngine`
   - Policy-driven deterministic decision logic.
   - Optional subagent recommendation input.
3. `FeedbackPublisher`
   - Provider-specific issue publishing (`github`, `gitlab`).
4. `ForkManager`
   - Detect/ensure fork context when required.
5. `FeedbackPublishJournal`
   - Minimal metadata: `dedupeKey`, `status`, issue URL, PR URL, target repo, last error.

## Config Proposal
```yaml
feedback:
  mode: scm # local | scm
  scm:
    provider: github # github | gitlab
    targetRepo: auto # auto | upstream | fork
    forkStrategy: upstream # upstream | fork | skip
    prReference: if_present # required | if_present | never
    minConfidence:
      bug_report: 0.6
      improvement_suggestion: 0.75
  decision:
    useSubagentSkill: true
    fallback: deterministic
```

## Data Contracts
In SCM issue body/footer, include stable markers:
- `<!-- ao:feedback-tool:bug_report -->`
- `<!-- ao:dedupe-key:<value> -->`
- `<!-- ao:session:<session-id> -->`

These markers power idempotent update/comment behavior.

## Delivery Plan
### Phase 1 (already in PR #403)
1. Tool contracts and strict schema validation.
2. Dedupe key generation.
3. Structured persistence.

### Phase 2 (new PR)
1. Add feedback routing config (`local` or `scm`).
2. Implement `FeedbackRouter` and `FeedbackPublisher` interface.
3. Implement GitHub publisher (issue create/update via dedupe markers).
4. Add publish journal.

### Phase 3 (new PR)
1. Add fork-aware decision execution.
2. Add optional subagent decision skill integration.
3. Add GitLab publisher parity.
4. Add end-to-end tests for issue-only vs issue+PR vs issue+fork.

## Testing Strategy
### Unit tests
1. config schema and defaults,
2. decision matrix behavior,
3. dedupe marker generation and issue matching,
4. fallback behavior when subagent output is invalid.

### Integration tests
1. GitHub issue create/update path,
2. fork ensure and reference logic,
3. publish journal retry/idempotency.

### End-to-end tests
1. self-blocking false -> issue only,
2. self-blocking true + upstream writable -> issue + PR ref,
3. self-blocking true + no upstream write -> issue + fork ref.

## Failure Handling
1. SCM API failure -> retain journal entry with retry metadata.
2. Duplicate publish attempts -> matched by dedupe marker; update existing issue instead of creating new one.
3. Invalid subagent decision -> ignore and use deterministic policy engine.

## Rollout
1. Ship disabled by default (`mode: local`).
2. Enable per project via explicit config.
3. Observe logs and publish outcomes before broader rollout.

## Summary
The orchestrator remains the source of reliable execution. Optional subagent skill can improve decision quality, but never owns side effects. Routing remains exclusive (`local` or `scm`) to avoid conflicting sources of truth.
