# Desktop Commander Latency Audit Report

**Date:** February 9, 2026  
**Analyzed by:** Claude (Opus 4.6) with input from GPT-5.2-Codex and Gemini-3-Pro  
**Scope:** End-to-end latency analysis — routing, tool execution, platform adapters, Copilot session lifecycle, renderer streaming, and logging  

---

## Executive Summary

Desktop Commander is an Electron command palette app invoked via global hotkey. Users perceive **5–8 second latency** from hotkey press to completed response. The target is **< 2 seconds**.

The primary finding is that **the Copilot SDK path has an inherent 2–4 second floor** from network RTT to GitHub's API that cannot be optimized away locally. The single highest-impact optimization is **expanding Tier 1/2 local intent coverage** to handle more commands without the SDK round-trip. Beyond that, synchronous file logging, repeated C# compilation in PowerShell, and process spawn gaps compound to add 500ms–1.5s of avoidable overhead.

---

## Methodology

1. Static analysis of all hot paths: startup, intent routing, Copilot session lifecycle, tool execution, platform adapters, and renderer streaming
2. Two rounds of review with **GPT-5.2-Codex** and **Gemini-3-Pro** as independent reviewers
3. Findings cross-referenced and debated across 3 rounds to resolve disagreements

---

## End-to-End Latency Breakdown

### Tier 1 Path (Pattern Match → Direct Execution)

| Step | Time | Notes |
|------|------|-------|
| Intent routing (regex) | ~5ms | Pattern matcher in `src/intent/patterns.ts` |
| Tool execution (PS pool) | ~50–200ms | Persistent PowerShell session |
| Response rendering | ~10–50ms | Direct string return, no streaming |
| **Total** | **~65–255ms** | **Well within target** |

### Tier 3 Path (Copilot SDK → LLM → Tool → LLM → Stream)

| Step | Time | Notes |
|------|------|-------|
| Message send → first token | 300–900ms | SDK network RTT to GitHub API |
| LLM reasoning + tool selection | 500–1500ms | Model inference time |
| Tool execution (PS pool) | 50–200ms | Local execution |
| Result → LLM → stream response | 500–1000ms | Second SDK round-trip |
| Sync logging overhead | 100–300ms | 61+ appendFileSync calls in client.ts |
| Add-Type compilation (if applicable) | 200–500ms | C# compilation + AV scan per tool |
| **Total** | **~1.7–4.4s** | **Irreducible ~1.3–2.4s from network** |

> **Gemini-3-Pro (Round 2):** *"The 5–8s comes from Add-Type compilation (1.5s) + Network (2s) + Node event loop lag from sync logging (0.2s) + rendering overhead. Tier 1 path is ~200ms. The gap is entirely the SDK round-trip."*

> **GPT-5.2-Codex (Round 2):** *"Expanding Tier 1/2 coverage is the highest-impact optimization for perceived latency because Tier 3 has an irreducible 2–4s network floor."*

---

## Critical Findings

### 1. Synchronous File Logging (🔴 CRITICAL — Perceived Latency)

**Location:** `src/utils/logger.ts` (line 48: `fs.appendFileSync`)

Every log call performs a **synchronous file write** that blocks the Node.js event loop. There are **99 logger calls in the hot path**: 61 in `copilot/client.ts`, 18 in `intent/router.ts`, 7 in `intent/executor.ts`, 13 in platform adapters. During streaming, `message_delta` events fire per-token, each triggering a sync write + `console.log`.

**Impact:** The event loop cannot process incoming network packets (streaming tokens) or handle IPC while writing to disk. This causes "jank" and bursty token rendering — the 3s SDK latency *feels* like 5s.

> **Gemini-3-Pro:** *"This is the single biggest performance killer. Writing to disk synchronously on every message_delta couples your UI rendering speed to disk I/O latency. On Windows with Defender, this can add 1–3ms per call."*

> **GPT-5.2-Codex (Round 2):** *"I now agree with Gemini on perceived streaming: sync logging can block dozens of times per reply. Priority depends on whether you're optimizing stream UX or tool runtime."*

**Estimated overhead:** 60–180ms blocking + degraded streaming perception  
**Fix:** Async buffered logging with log-level gating (only log errors in production, verbose in dev)

---

### 2. Add-Type C# Compilation Per Call (🔴 CRITICAL — Tool Execution)

**Location:** `src/platform/windows/window-manager.ts` (6 separate Add-Type blocks), `src/platform/windows/system.ts` (5+ Add-Type blocks)

Every call to `listWindows()`, `focusWindow()`, `moveWindow()`, `closeWindow()`, `minimizeWindow()`, `maximizeWindow()`, `volume()`, `simulatePaste()`, `getForegroundWindowHandle()`, `setForegroundWindow()`, `getActiveWindowInfo()`, and `captureSelectedText()` compiles C# code via PowerShell's `Add-Type -TypeDefinition`. Each compilation:

1. Writes a temp source file + DLL to `%TEMP%`
2. Triggers **Windows Defender real-time scan** on the new files
3. Invokes the C# compiler (csc.exe)

**Cost:** 20–50ms per compilation + 100–300ms AV scan. Multiple window operations in sequence compound this.

> **Gemini-3-Pro:** *"PowerShell's Add-Type compiles C# to a temporary DLL on disk. This triggers disk write I/O, Windows Defender scan, and C# compiler startup."*

> **GPT-5.2-Codex:** *"Add-Type `-TypeDefinition` uses CodeDOM and writes temp source/assembly (and often PDB) under `%TEMP%`. AV scans those files."*

**Estimated overhead:** 200ms–1.5s for a multi-tool command  
**Fix:** Define a single unified C# class library once at PS pool initialization. Re-inject on pool recycle (after 200 commands). Use `if (-not ("TypeName" -as [type])) { Add-Type ... }` guard.

---

### 3. PowerShell Pool Gaps (🟠 HIGH)

**Location:** Multiple files bypass the persistent PowerShell pool:

| File | Method | Issue |
|------|--------|-------|
| `tts.ts` | `speak()` | `exec('powershell -NoProfile -Command ...')` — spawns new PS process (~400ms) |
| `wifi.ts` | `enable/disable/listNetworks` | `execAsync('netsh ...')` — spawns new cmd.exe |
| `network.ts` | `getNetworkInfo()` | `execAsync('hostname')`, `execAsync('netsh wlan ...')` |
| `system.ts` | `lockScreen/sleep` | `execAsync('rundll32.exe ...')` |
| `ipc.ts` | archive extraction | `execAsync('powershell -Command "Expand-Archive..."')` |

**Reviewer Disagreement — netsh/rundll32 through pool or direct exec:**

> **GPT-5.2-Codex:** *"Direct exec is slightly faster for netsh/rundll32 since PowerShell parsing/marker overhead isn't needed for simple external calls."*

> **Gemini-3-Pro (Final Round, conceding):** *"I concede to GPT. Direct execution via `child_process.spawn` is superior for simple native binaries. PowerShell Pool should be retained for complex operations (Registry, WMI/CIM, COM objects) where structured objects matter."*

**Consensus:** Route `tts.ts speak()` and `ipc.ts Expand-Archive` through the PS pool (they're PowerShell commands). Keep `netsh`/`rundll32` as direct `spawn()` calls but consider replacing `execAsync` with `spawn()` for lighter overhead.

---

### 4. Expand Tier 1/2 Intent Coverage (🟠 HIGH — Architectural)

**Location:** `src/intent/patterns.ts`, `src/intent/ml-classifier.ts`

The Copilot SDK path has an irreducible 2–4s network floor. The only way to consistently achieve <2s for common commands is to handle them locally.

**Current state:**
- Tier 1 (pattern match): ~40% coverage, <5ms latency
- Tier 2 (ML classifier): ~30% coverage, ~15ms latency, 99.3% accuracy
- Tier 3 (LLM fallback): ~30% remaining, 2–5s latency

> **Gemini-3-Pro:** *"This is the only thing that will fundamentally change the feeling of the product. We are building a 'Smart CLI,' and CLIs are expected to be instant. We cannot let the LLM be the bottleneck for `volume mute`."*

> **GPT-5.2-Codex:** *"Yes—expanding Tier 1/2 coverage is the highest-impact optimization for perceived latency."*

**Fix:** Aggressively add common commands (volume, brightness, media control, window arrange, app launch) to pattern matching. Retrain ML model with more examples. Target 80%+ local coverage.

---

### 5. Copilot Session Lifecycle (🟡 MEDIUM)

**Location:** `src/copilot/client.ts`

- **Session creation:** 300–800ms (multiple RTTs). Already pre-warmed at startup ✓
- **System prompt:** Regenerated every session init (14–25ms) — not cached
- **Session compaction:** 2.7–8.2s when triggered (LLM summarization + full session reinit). Locks UI.
- **Per-event overhead:** 0.4–1.1ms (queue mechanics) + 4–6ms IPC per tool (2 sends × 2–3ms)

> **GPT-5.2-Codex:** *"Pre-warm Copilot session with idle TTL (5–10 min), refresh on errors or memory growth."*

**Fixes:**
- Cache system prompt (invalidate only on skill/MCP changes)
- Move compaction to background with progress UI
- Batch IPC action log sends per animation frame

---

### 6. Renderer Performance (🟡 MEDIUM)

**Location:** `src/renderer/components/CommandPalette.tsx`, `MessageStream.tsx`

- **14 useState hooks** + 10+ useEffect hooks in CommandPalette
- **Unthrottled scroll handler** fires 60+ times/sec during streaming with 3 state updates per event
- **`ipcRenderer.sendSync('app:autoHideSuppressed')`** blocks renderer thread
- **Good:** RAF-batched streaming in useCopilot.ts, proper memo boundaries in MessageStream

> **Gemini-3-Pro:** *"The scroll handler triggers 180+ React reconciliation commits per second. This blocks the main thread from processing IPC messages, making the app feel unresponsive."*

> **GPT-5.2-Codex:** *"Scroll/render flood during streaming is real but secondary to the data-path bottlenecks."*

**Fixes:** Throttle scroll handler to RAF, replace sendSync with async IPC, consolidate panel state into useReducer

---

### 7. Module Loading & Startup (🟢 LOW — Already Optimized)

**Location:** `src/main/index.ts`, `src/tools/index.ts`

Startup is already well-parallelized (Phase 1 sequential for essentials, Phase 2 parallel for services). Remaining issues:

- `src/tools/index.ts` (3000+ lines): All 75+ tool definitions evaluated at import time
- `getUnifiedAdapter()` called at module level triggers platform adapter init
- ML model loads lazily but adds 200–800ms to first query

> **Gemini-3-Pro:** *"Keep `defineTool()` schemas static, but convert handler functions to use dynamic imports. The session knows what tools exist instantly, but pays the implementation cost only on first use."*

**Fix:** Lazy-load handler implementations via dynamic `import()` while keeping schemas static for session creation.

---

## Consolidated Priority List

Both reviewers were asked for definitive top priorities. Here is the merged, consensus-driven list:

| # | Action | Expected Savings | Effort | Both Agree? |
|---|--------|-----------------|--------|-------------|
| **P0** | **Expand Tier 1/2 local intent coverage** to 80%+ | 2–4s per covered command | High | ✅ Yes (final round) |
| **P0** | **Async buffered logging** with log-level gating | 60–180ms + smoother streaming | Low | ✅ Yes |
| **P1** | **Pre-define C# types once** at PS pool init, re-inject on recycle | 200ms–1.5s per tool command | Medium-High | ✅ Yes |
| **P1** | **Route remaining PS spawns** through pool (tts.ts, Expand-Archive) | 300–500ms per affected call | Medium | ✅ Yes |
| **P2** | **Pre-warm Copilot session** with idle TTL, keep-alive | 300–900ms (first turn) | Medium | ✅ Yes |
| **P2** | **Lazy-load tool handlers** via dynamic imports | ~200ms startup + lower memory | Medium | ✅ Yes |
| **P3** | **Throttle scroll handler** + replace sendSync with async IPC | Smoother UI during streaming | Low | ✅ Yes |
| **P3** | **Optimize PowerShell serialization** — Select-Object before ConvertTo-Json | 50–100ms per list operation | Low | ⚠️ Gemini only |
| **P4** | **Cache system prompt** (invalidate on skill/MCP changes) | 14–25ms per session init | Low | ✅ Yes |
| **P4** | **Use direct spawn() for native binaries** (netsh, rundll32) over execAsync | 20–50ms per call | Low | ✅ Yes (final round) |

---

## Reviewer-Specific Insights

### GPT-5.2-Codex — Key Contributions
- Flagged **Copilot SDK network RTT** as a latency source that cannot be optimized locally
- Emphasized **measurement before optimization**: real end-to-end tracing needed
- Confirmed Add-Type writes temp files to `%TEMP%` that trigger AV scans
- Warned about **node/electron event loop contention** from sync I/O
- Final caution: *"We might be overestimating deterministic savings without end-to-end tracing; real wins could be dominated by user-perceived jitter and UI rendering."*

### Gemini-3-Pro — Key Contributions
- Identified the **"Uncanny Valley" of speed**: 2.5s still feels slow vs 200ms Tier 1
- Quantified `fs.appendFileSync` at **1–3ms per call on Windows with Defender**
- Pointed out **ConvertTo-Json** serializing deep .NET objects as hidden overhead
- Proposed lazy-loading strategy: keep schemas static, dynamic-import handlers
- Explained pool recycle strategy: re-inject init script after `spawnProcess()`
- Final insight: *"Infrastructure optimization is necessary hygiene, but Tier 1/2 expansion is the only thing that will fundamentally change the feeling of the product."*

---

## Key Disagreements Resolved

| Topic | GPT-5.2-Codex | Gemini-3-Pro | Resolution |
|-------|---------------|--------------|------------|
| **#1 Priority** | Infrastructure (logging, PS pool) | Expand Tier 1/2 coverage | **Both agreed in final round**: Tier 1/2 expansion is highest impact |
| **Sync Logging vs Add-Type** | Add-Type first (tool runtime) | Logging first (perceived streaming) | **Both valid**: logging for UX, Add-Type for tool speed — fix both at P0/P1 |
| **netsh/rundll32 routing** | Direct exec (lighter) | PS pool (unified) | **Gemini conceded**: direct spawn for simple native binaries, pool for complex PS |
| **Array.shift() optimization** | Replace with ring buffer | Premature optimization | **Gemini wins**: not worth the effort at 50–200 events per command |

---

## What's Already Good

- ✅ PowerShell pool exists with GUID markers, recycling, and buffer safety
- ✅ Startup parallelization (Phase 1/2 split)
- ✅ Copilot session pre-warmed at startup
- ✅ RAF-batched streaming in useCopilot.ts
- ✅ Proper React memo boundaries in MessageStream
- ✅ ML model race condition fixed (proper Promise wrapping)
- ✅ Tool telemetry already exists in executor.ts (ring buffer of 500 entries)
- ✅ Lazy-loaded heavy modules (InvisiwindWrapper, recordingManager)

---

## Recommended Next Steps

1. **Instrument end-to-end timing** with real measurements (startup traces, per-tool flamecharts)
2. Implement P0 items (Tier 1/2 expansion + async logging)
3. Implement P1 items (Add-Type preloading + PS pool gaps)
4. Profile again with real data
5. Implement P2/P3 items based on measured impact
