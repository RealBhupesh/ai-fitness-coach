# AGENTS.md

## Caveman mode

Use Caveman-style responses by default in this repository.

Rules:

- Be terse.
- Drop filler, greetings, repeated explanations, and unnecessary hedging.
- Keep technical accuracy.
- Prefer short bullets/fragments.
- Do not compress code blocks, commands, paths, JSON, TOML, diffs, API payloads, or exact evidence.
- For code review, still include required proof: file/function/snippet, expected vs actual, repro, fix, test idea, priority, confidence.
- For complex tasks, keep enough detail to avoid mistakes.
- Stop Caveman style only when user says: normal mode.

---
## Mandatory CodeGraph Workflow

If `.codegraph/` exists, use CodeGraph first.

Before code review, refactor, bug verification, implementation, or architecture analysis:

1. Run `codegraph_status`.
2. Confirm the graph is initialized and healthy.
3. Use `codegraph_files`, `codegraph_search`, or `codegraph_context` to find relevant files.
4. Use `codegraph_callers`, `codegraph_callees`, or `codegraph_impact` when changing or reviewing logic that affects other code.
5. Read only the files that are actually required.
6. Do not scan the full repository with grep/read unless CodeGraph fails or the index is incomplete.
7. Before editing files, explain the plan and wait for user approval.
8. After editing, run the smallest relevant validation command.

The agent must not directly jump into broad file reads.
---

# MCP Tool Use Cases

When CodeGraph is running as an MCP server, use these tools according to the task.

Tool names may appear directly as `codegraph_status`, `codegraph_search`, etc., or through the Pi MCP adapter depending on the client.

---
## `codegraph_status`

Purpose:

Check graph health, index status, file count, language coverage, backend, and whether CodeGraph is ready.

Use this first before any graph-based work.

Use when:

- starting a review
- starting implementation
- debugging missing context
- checking whether the index is fresh
- confirming CodeGraph is working in Pi / Codex / Claude / Cursor
- verifying whether the backend is native or WASM

Expected behavior:

- If healthy, continue with graph tools.
- If not initialized, ask user to run `codegraph init -i`.
- If stale, suggest `codegraph sync`.
- If backend is WASM and slow, mention native `better-sqlite3` may be better.

Example instruction:

```
Use codegraph_status first. Report graph health, indexed file count, languages, and backend. Do not edit anything.
```

## Mandatory Usage

Use context-mode automatically for:

- repo-wide scans
- reading many files
- large `grep` / `find` results
- long terminal output
- test output analysis
- logs analysis
- generated reports
- documentation fetching
- web/docs indexing
- multi-file code review
- scanner architecture review
- Codex/Pi review tasks that may inspect many files

## Tool Selection Rules

- Use `ctx_batch_execute` when multiple commands or searches are needed.
- Use `ctx_execute` for scripted analysis instead of many raw shell commands.
- Use `ctx_execute_file` when analyzing large files without editing them.
- Use `ctx_fetch_and_index` for web/docs fetching instead of raw `curl` / `wget`.
- Use `ctx_index` to store long markdown/spec/report content for later search.
- Use `ctx_search` to retrieve only relevant indexed snippets.
- Use `ctx_stats` after large tasks to verify context savings.
- Use `ctx_doctor` when context-mode appears broken.
- Do not use `ctx_upgrade` unless the user asks to update/fix context-mode.
- Do not use `ctx_purge` unless the user explicitly asks to delete indexed context-mode data.

## Small Output Exception

Do not force context-mode for small, direct reads or simple commands.

Normal tools are acceptable for:

- reading one small file
- checking one config value
- running one short command
- making exact approved file edits
- viewing a small error message

## Avoid Raw Context Dumps

Do not dump huge raw file/tool output into chat unless the user explicitly asks.

Avoid:

- full raw file dumps
- full raw logs
- full raw test output
- large `grep` output
- large `find` output
- raw HTML
- raw API responses
- long generated reports

Instead, summarize results and include only exact relevant snippets, filenames, line references, and findings.

## Secrets and Safety Rule

Never index, print, summarize, or expose secrets.

Avoid indexing or dumping:

- `.env`
- `.env.local`
- API keys
- tokens
- passwords
- cookies
- private keys
- credentials
- production secrets
- private webhook URLs

If a command may expose secrets, stop and ask for approval or use a safer targeted command.

## Editing Rule

For editing files:

- Use normal file read/edit tools when exact edits are required.
- Use context-mode for investigation, analysis, indexing, large search, and large output compression.
- Never edit files until the user approves the plan.
- Before editing, return affected files, exact change plan, and risk level.

## Verification Rule

After any large repo inspection or code review, run:

```text
ctx stats
```
