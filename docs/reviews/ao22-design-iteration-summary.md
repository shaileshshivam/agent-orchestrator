# AO22 Design Iteration Summary

## What was updated

1. `docs/design/feedback-routing-and-followup-design.md`
   - Formalized the full pipeline: report -> issue -> agent-session -> PR.
   - Added explicit sections for:
     - trigger conditions,
     - session spawning contract,
     - target selection (upstream vs fork),
     - PR creation/linking requirements,
     - idempotency/retry semantics,
     - governance hooks per fork-owner policy.

2. `docs/pr-403-feedback-tools-explainer.html`
   - Refreshed to match the new formal architecture.
   - Added visual sections mirroring the same six design contracts and the formal pipeline.

## Intent

This iteration is design formalization only. No runtime/code behavior was introduced by this request.

## Ready for review

The docs now provide a deterministic contract for implementing fork-aware report->issue->session->PR execution in follow-up PRs.
