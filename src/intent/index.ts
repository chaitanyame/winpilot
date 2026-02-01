/**
 * Intent Classification System
 *
 * This module provides a hybrid intent classification system for WinPilot,
 * combining pattern matching and FastText ML model to handle 65-70% of user
 * queries locally, reducing LLM calls and improving response time.
 *
 * Architecture:
 * - Tier 1: Pattern Matching (0-5ms, ~40% coverage)
 * - Tier 2: FastText ML Model (5-15ms, ~30% coverage)
 * - Tier 3: LLM Fallback (2000ms, ~30% remaining)
 */

export { IntentRouter } from './router';
export { PatternMatcher } from './patterns';
export { MLIntentClassifier } from './ml-classifier';
export { ParameterExtractor } from './extractors';
export { ToolExecutor } from './executor';
export { TelemetryManager } from './telemetry';

export type {
  RouteResult,
  PatternMatchResult,
  ClassificationResult,
  ToolExecutionResult,
  TelemetryEvent,
  ClassificationTier,
} from './types';
