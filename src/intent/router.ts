/**
 * Intent Classification System - Intent Router
 *
 * This module orchestrates the three-tier classification pipeline:
 * Tier 1: Pattern Matching (0-5ms, ~40% coverage)
 * Tier 2: FastText ML Model (5-15ms, ~30% coverage)
 * Tier 3: LLM Fallback (2000ms, ~30% remaining)
 */

import { PatternMatcher } from './patterns';
import { MLIntentClassifier } from './ml-classifier';
import { ParameterExtractor } from './extractors';
import { ToolExecutor } from './executor';
import { RouteResult, CONFIDENCE_THRESHOLDS, TelemetryEvent } from './types';
import { logger } from '../utils/logger';

/**
 * Intent Router
 * Main orchestration class for the hybrid classification system
 */
export class IntentRouter {
  private patternMatcher: PatternMatcher;
  private mlClassifier: MLIntentClassifier;
  private paramExtractor: ParameterExtractor;
  private executor: ToolExecutor;
  private telemetry: TelemetryEvent[] = [];

  constructor() {
    this.patternMatcher = new PatternMatcher();
    this.mlClassifier = new MLIntentClassifier();
    this.paramExtractor = new ParameterExtractor();
    this.executor = new ToolExecutor();
  }

  /**
   * Initialize the router (loads ML model)
   */
  async initialize(): Promise<void> {
    logger.copilot('Initializing IntentRouter...');
    await this.mlClassifier.initialize();

    if (this.mlClassifier.isAvailable()) {
      logger.copilot('IntentRouter initialized with ML classification enabled');
    } else {
      logger.copilot('IntentRouter initialized (ML classification disabled: ' + this.mlClassifier.getError() + ')');
    }
  }

  /**
   * Route a user query through the classification pipeline
   */
  async route(message: string): Promise<RouteResult> {
    const startTime = Date.now();
    const query = message.trim();

    logger.copilot('Intent routing started', { query: query.substring(0, 50) });

    try {
      // TIER 1: Pattern Matching (0-5ms, ~40% coverage)
      const patternResult = await this.tryPatternMatching(query);
      if (patternResult.handled) {
        this.recordTelemetry(query, 1, patternResult, startTime);
        return patternResult;
      }

      // TIER 2: FastText ML Model (5-15ms, ~30% coverage)
      const mlResult = await this.tryMLClassification(query);
      if (mlResult.handled) {
        this.recordTelemetry(query, 2, mlResult, startTime);
        return mlResult;
      }

      // TIER 3: LLM Fallback
      const fallbackResult = this.createFallbackResult(query, patternResult, mlResult);
      this.recordTelemetry(query, 3, fallbackResult, startTime);
      return fallbackResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.copilot('Intent routing error: ' + errorMessage, 'error');

      const errorResult: RouteResult = {
        handled: false,
        reason: `Routing error: ${errorMessage}`,
      };
      this.recordTelemetry(query, 'llm', errorResult, startTime);
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
      return { handled: false, reason: 'No pattern match' };
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
   * Try Tier 2: ML Classification
   */
  private async tryMLClassification(query: string): Promise<RouteResult> {
    // Skip if ML is not available
    if (!this.mlClassifier.isAvailable()) {
      return { handled: false, reason: 'ML classifier not available' };
    }

    const mlResult = await this.mlClassifier.classify(query);

    // Check confidence threshold
    if (mlResult.confidence < CONFIDENCE_THRESHOLDS.ML_CLASSIFICATION) {
      logger.copilot('ML classification: low confidence', {
        intent: mlResult.intent,
        confidence: mlResult.confidence.toFixed(2),
        threshold: CONFIDENCE_THRESHOLDS.ML_CLASSIFICATION,
      });

      // Try parameter extraction for medium confidence
      if (mlResult.confidence >= CONFIDENCE_THRESHOLDS.ML_MEDIUM) {
        return await this.tryWithParameterExtraction(query, mlResult.intent, mlResult.confidence);
      }

      return { handled: false, reason: 'ML confidence too low' };
    }

    logger.copilot('ML classification: high confidence', {
      intent: mlResult.intent,
      confidence: mlResult.confidence.toFixed(2),
    });

    // Extract parameters if needed
    const params = await this.paramExtractor.extract(query, mlResult.intent);

    // Execute the tool
    const executionResult = await this.executor.execute(mlResult.intent, params);

    if (!executionResult.success) {
      logger.copilot('ML classification: execution failed', { error: executionResult.error });
      return {
        handled: false,
        reason: `Execution failed: ${executionResult.error}`,
        failedToolName: mlResult.intent,
        failedError: executionResult.error || executionResult.response,
        originalTier: 2,
      };
    }

    return {
      handled: true,
      response: executionResult.response,
      toolName: mlResult.intent,
      confidence: mlResult.confidence,
      tier: 2,
    };
  }

  /**
   * Try execution with parameter extraction for medium confidence ML results
   */
  private async tryWithParameterExtraction(
    query: string,
    intent: string,
    confidence: number
  ): Promise<RouteResult> {
    logger.copilot('Trying parameter extraction', { intent, confidence: confidence.toFixed(2) });

    try {
      const params = await this.paramExtractor.extract(query, intent);

      // Check if we got required parameters
      // If extraction returned empty object and tool needs params, fall back to LLM
      if (Object.keys(params).length === 0 && this.toolNeedsParameters(intent)) {
        logger.copilot('Parameter extraction: no parameters found for tool needing params');
        return { handled: false, reason: 'Missing required parameters' };
      }

      // Try to execute
      const executionResult = await this.executor.execute(intent, params);

      if (!executionResult.success) {
        logger.copilot('Parameter extraction: execution failed', { error: executionResult.error });
        return {
          handled: false,
          reason: `Execution failed: ${executionResult.error}`,
          failedToolName: intent,
          failedError: executionResult.error || executionResult.response,
          originalTier: 2,
        };
      }

      return {
        handled: true,
        response: executionResult.response,
        toolName: intent,
        confidence,
        tier: 2,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.copilot('Parameter extraction error: ' + errorMessage, 'error');
      return {
        handled: false,
        reason: `Parameter extraction failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Check if a tool typically needs parameters
   */
  private toolNeedsParameters(intent: string): boolean {
    const parameterlessTools = [
      'window_list',
      'system_info',
      'network_info',
      'apps_list',
      'process_list',
      'clipboard_read',
      'clipboard_clear',
      'service_list',
      'system_lock',
      'system_sleep',
      'list_reminders',
      'productivity_worldclock',
    ];
    return !parameterlessTools.includes(intent);
  }

  /**
   * Create fallback result for LLM
   */
  private createFallbackResult(_query: string, patternResult: any, mlResult: any): RouteResult {
    const patternConf = patternResult?.confidence || 0;
    const mlConf = mlResult?.confidence || 0;

    logger.copilot('Falling back to LLM', {
      patternConfidence: patternConf.toFixed(2),
      mlConfidence: mlConf.toFixed(2),
    });

    return {
      handled: false,
      reason: `Low confidence (Pattern: ${patternConf.toFixed(2)}, ML: ${mlConf.toFixed(2)})`,
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
      query: query.substring(0, 100), // Truncate for privacy
      tier,
      toolName: result.toolName,
      confidence: result.confidence,
      latency: Date.now() - startTime,
      timestamp: Date.now(),
      success: result.handled,
      error: result.reason,
    };

    this.telemetry.push(event);

    // Keep only last 1000 events to avoid memory issues
    if (this.telemetry.length > 1000) {
      this.telemetry.shift();
    }

    // Log telemetry
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
