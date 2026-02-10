/**
 * Intent Classification System
 *
 * Hybrid intent classification for WinPilot:
 * - Tier 1: Enhanced Pattern Matching (0-5ms, ~55-60% coverage)
 *   NLP-flexible regex with conversational prefix stripping
 * - Tier 2: GPT-4o-mini Tool Selection (500ms-1s, via Copilot SDK)
 * - Tier 3: GPT-4o Full Reasoning (2-4s, via Copilot SDK)
 *
 * Tiers 2 & 3 are handled by the CopilotController's dual-session routing.
 */

export { IntentRouter } from './router';
export { PatternMatcher } from './patterns';
export { ParameterExtractor } from './extractors';
export { ToolExecutor } from './executor';
export { TelemetryManager } from './telemetry';

export type {
  RouteResult,
  PatternMatchResult,
  ToolExecutionResult,
  TelemetryEvent,
  ClassificationTier,
} from './types';
