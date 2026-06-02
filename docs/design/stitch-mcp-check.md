# Stitch MCP Connectivity Check

Date: 2026-06-02

## Results

- `initialize`: success (HTTP 200)
- `tools/list`: success (HTTP 200)
- `tools/call` (`list_projects`): unauthorized (HTTP 401) without API key

## Required setup

1. Set `STITCH_API_KEY` in the environment used by Cursor/agent.
2. Provide Stitch project id.
3. Re-run:
   - `initialize`
   - `tools/list`
   - `tools/call` for `get_project` and `list_screens`
