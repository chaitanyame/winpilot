/**
 * Intent Classification System - Intent Router
 *
 * This module orchestrates the classification pipeline:
 * Tier 1: Pattern Matching (0-5ms, ~55-60% coverage)
 * Tier 2: GPT-4o-mini Tool Selection (via Copilot SDK, 500ms-1s)
 * Tier 3: GPT-4o Full Reasoning (via Copilot SDK, 2-4s)
 *
 * Tiers 2 & 3 are handled by the CopilotController's dual-session routing.
 * This router handles Tier 1 (patterns) and skill keyword detection.
 */

import { PatternMatcher } from './patterns';
import { ToolExecutor } from './executor';
import { detectSkillIdFromMessage } from './skill-intents';
import { RouteResult, CONFIDENCE_THRESHOLDS, TelemetryEvent } from './types';
import { logger } from '../utils/logger';

/**
 * Intent Router
 * Handles Tier 1 pattern matching and skill detection.
 * Unmatched queries fall through to the CopilotController's dual-session LLM routing.
 */
export class IntentRouter {
  private patternMatcher: PatternMatcher;
  private executor: ToolExecutor;
  private telemetry: TelemetryEvent[] = [];

  constructor() {
    this.patternMatcher = new PatternMatcher();
    this.executor = new ToolExecutor();
  }

  /**
   * Initialize the router
   */
  async initialize(): Promise<void> {
    logger.copilot('Initializing IntentRouter (pattern-based, no ML)...');
    logger.copilot('IntentRouter initialized with pattern matching + LLM fallback');
  }

  /**
   * Route a user query through the classification pipeline
   */
  async route(message: string): Promise<RouteResult> {
    const startTime = Date.now();
    const query = message.trim();

    logger.copilot('Intent routing started', { query: query.substring(0, 50) });

    try {
      // TIER 1: Pattern Matching (0-5ms, ~55-60% coverage)
      const patternResult = await this.tryPatternMatching(query);
      if (patternResult.handled) {
        this.recordTelemetry(query, 1, patternResult, startTime);
        return patternResult;
      }

      // Skill keyword detection (document types, etc.)
      const skillId = detectSkillIdFromMessage(query);
      if (skillId) {
        logger.copilot('Skill intent detected via keywords', { skillId });
        const skillResult: RouteResult = {
          handled: false,
          skillId,
          reason: 'Skill intent detected',
        };
        this.recordTelemetry(query, 3, skillResult, startTime);
        return skillResult;
      }

      // TIER 2 & 3: Fall through to CopilotController (GPT-4o-mini → GPT-4o)
      const fallbackResult: RouteResult = {
        handled: false,
        reason: `No pattern match (confidence: ${patternResult.confidence?.toFixed(2) || '0'})`,
      };
      this.recordTelemetry(query, 3, fallbackResult, startTime);
      return fallbackResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.copilot('Intent routing error: ' + errorMessage, 'error');

      const errorResult: RouteResult = {
        handled: false,
        reason: `Routing error: ${errorMessage}`,
      };
      this.recordTelemetry(query, 3, errorResult, startTime);
      return errorResult;
    }
  }

  /**
   * Try Tier 1: Pattern Matching
   */
  private async tryPatternMatching(query: string): Promise<RouteResult> {
    const patternMatch = this.patternMatcher.match(query);

    if (!patternMatch.matched || patternMatch.confidence < CONFIDENCE_THRESHOLDS.PATTERN_MATCH) {
      logger.copilot('Pattern match: no match or low confidence', {
        confidence: patternMatch.confidence.toFixed(2),
      });
      return { handled: false, reason: 'No pattern match', confidence: patternMatch.confidence };
    }

    logger.copilot('Pattern match: found', {
      tool: patternMatch.toolName,
      confidence: patternMatch.confidence.toFixed(2),
    });

    // Execute the tool
    const executionResult = await this.executor.execute(
      patternMatch.toolName,
      patternMatch.params || {}
    );

    if (!executionResult.success) {
      logger.copilot('Pattern match: execution failed', { error: executionResult.error });
      return {
        handled: false,
        reason: `Execution failed: ${executionResult.error}`,
        failedToolName: patternMatch.toolName,
        failedError: executionResult.error || executionResult.response,
        originalTier: 1,
      };
    }

    return {
      handled: true,
      response: executionResult.response,
      toolName: patternMatch.toolName,
      confidence: patternMatch.confidence,
      tier: 1,
    };
  }

  /**
   * Record telemetry for analytics
   */
  private recordTelemetry(
    query: string,
    tier: 1 | 2 | 3 | 'llm',
    result: RouteResult,
    startTime: number
  ): void {
    const event: TelemetryEvent = {
      query: query.substring(0, 100),
      tier,
      toolName: result.toolName,
      confidence: result.confidence,
      latency: Date.now() - startTime,
      timestamp: Date.now(),
      success: result.handled,
      error: result.reason,
    };

    this.telemetry.push(event);

    if (this.telemetry.length > 1000) {
      this.telemetry.shift();
    }

    logger.copilot('Intent routing complete', {
      tier: tier === 'llm' ? 'LLM' : `Tier ${tier}`,
      handled: result.handled,
      latency: `${event.latency}ms`,
    });
  }

  /**
   * Get telemetry statistics
   */
  getTelemetryStats(): {
    total: number;
    tier1: number;
    tier2: number;
    llm: number;
    avgLatency: { tier1: number; tier2: number };
    successRate: number;
  } {
    const total = this.telemetry.length;
    const tier1 = this.telemetry.filter((e) => e.tier === 1).length;
    const tier2 = this.telemetry.filter((e) => e.tier === 2).length;
    const llm = this.telemetry.filter((e) => e.tier === 3 || e.tier === 'llm').length;

    const tier1Latencies = this.telemetry.filter((e) => e.tier === 1).map((e) => e.latency);
    const tier2Latencies = this.telemetry.filter((e) => e.tier === 2).map((e) => e.latency);

    const avgTier1 = tier1Latencies.length > 0
      ? tier1Latencies.reduce((a, b) => a + b, 0) / tier1Latencies.length
      : 0;
    const avgTier2 = tier2Latencies.length > 0
      ? tier2Latencies.reduce((a, b) => a + b, 0) / tier2Latencies.length
      : 0;

    const successful = this.telemetry.filter((e) => e.success).length;
    const successRate = total > 0 ? successful / total : 0;

    return {
      total,
      tier1,
      tier2,
      llm,
      avgLatency: {
        tier1: Math.round(avgTier1),
        tier2: Math.round(avgTier2),
      },
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Clear telemetry data
   */
  clearTelemetry(): void {
    this.telemetry = [];
  }
}
