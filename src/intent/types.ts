/**
 * Intent Classification System - Type Definitions
 *
 * This module defines all TypeScript interfaces and types used across
 * the intent classification system.
 */

/**
 * Confidence threshold configuration
 */
export const CONFIDENCE_THRESHOLDS = {
  PATTERN_MATCH: 0.95,      // Tier 1: Pattern matching must be very confident
  ML_CLASSIFICATION: 0.85,  // Tier 2: ML model threshold for direct execution
  ML_MEDIUM: 0.60,          // Tier 2: Medium confidence - try parameter extraction
} as const;

/**
 * Classification tier
 */
export type ClassificationTier = 1 | 2 | 3;

/**
 * Result from pattern matching
 */
export interface PatternMatchResult {
  toolName: string;
  confidence: number;
  params?: Record<string, any>;
  matched: boolean;
}

/**
 * Result from ML classification
 */
export interface ClassificationResult {
  intent: string;
  confidence: number;
  alternatives?: Array<{
    intent: string;
    confidence: number;
  }>;
}

/**
 * Result from intent routing
 */
export interface RouteResult {
  handled: boolean;
  response?: string;
  toolName?: string;
  confidence?: number;
  tier?: ClassificationTier;
  reason?: string;
  /** Tool that was attempted but failed (for LLM fallback context) */
  failedToolName?: string;
  /** Error from the failed tool execution */
  failedError?: string;
  /** Which tier attempted execution before failing */
  originalTier?: ClassificationTier;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  response: string;
  error?: string;
}

/**
 * Pattern definition for regex matching
 */
export interface QueryPattern {
  pattern: RegExp;
  confidence: number;
}

/**
 * Action pattern with parameter extraction
 */
export interface ActionPattern {
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => Record<string, any>;
  confidence: number;
}

/**
 * Telemetry event for routing decisions
 */
export interface TelemetryEvent {
  query: string;
  tier: ClassificationTier | 'llm';
  toolName?: string;
  confidence?: number;
  latency: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

/**
 * Parameter extraction context
 */
export interface ExtractionContext {
  query: string;
  intent: string;
  confidence: number;
}

/**
 * Extracted parameters
 */
export interface ExtractedParams {
  [key: string]: any;
}

/**
 * Tool metadata from tools/index.ts
 */
export interface ToolMetadata {
  name: string;
  description: string;
  parameters: Record<string, any>;
}
