<!-- CODEX-AGENT-CREWS-START -->
## Codex Agent Crews

If `.codex/crews-routing.md` exists, read it before making code changes in this project.
Also read `.codex/crews-config.md` and `.codex/stack-profile.md` when they exist.

These files define project stack rules, custom constraints, workflow routing, and validation expectations.
<!-- CODEX-AGENT-CREWS-END -->

## Golf Analyzer Baseline

Read these project documents before changing analysis architecture, upload orchestration, camera
meta flow, or inference behavior:

- `.codex/01-golf-analysis-architecture.md`
- `.codex/02-cross-repo-refactor-plan.md`
- `.codex/03-body-club-fusion-schema.md`

## Project Workspace

This folder is part of one multi-repository Raspberry Pi/Hailo project.
When working here, treat these sibling folders as the same project workspace and inspect them when behavior crosses project boundaries:

- `hailo-front`: `/Users/hwangjunguk/Desktop/Ray/UK/hailo-front`
- `hailo-back`: `/Users/hwangjunguk/Desktop/Ray/UK/hailo-back`
- `hailo-camera`: `/Users/hwangjunguk/Desktop/Ray/UK/hailo-camera`
- `hailo-infer`: `/Users/hwangjunguk/Desktop/Ray/UK/hailo-infer`

Before changing API contracts, camera/inference flows, shared configuration, deployment scripts, or integration behavior, check the relevant sibling project paths above instead of reasoning from this folder alone.

Use `hailo-front` as the workspace anchor, but do not treat it as an isolated frontend project. For
analysis-related work, assume `hailo-back`, `hailo-camera`, and `hailo-infer` are in scope by
default.
