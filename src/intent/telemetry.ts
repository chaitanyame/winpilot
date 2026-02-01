/**
 * Intent Classification System - Telemetry & Monitoring
 *
 * This module provides telemetry collection and analytics for the intent
 * classification system. Tracks routing decisions, latency, accuracy, and
 * tier distribution.
 */

import { TelemetryEvent } from './types';
import { logger } from '../utils/logger';

/**
 * Telemetry statistics
 */
export interface TelemetryStats {
  total: number;
  tier1: number;
  tier2: number;
  llm: number;
  avgLatency: {
    tier1: number;
    tier2: number;
    llm: number;
  };
  successRate: number;
  tier1Coverage: number;
  tier2Coverage: number;
  llmFallback: number;
  topTools: Array<{ tool: string; count: number }>;
  recentEvents: TelemetryEvent[];
}

/**
 * Telemetry Manager
 * Collects and analyzes telemetry data for the intent classification system
 */
export class TelemetryManager {
  private events: TelemetryEvent[] = [];
  private maxEvents = 1000;

  /**
   * Record a telemetry event
   */
  record(event: TelemetryEvent): void {
    this.events.push(event);

    // Keep only the most recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log important events
    if (event.success) {
      logger.copilot('Intent routing succeeded', {
        tier: event.tier,
        tool: event.toolName,
        latency: `${event.latency}ms`,
      });
    } else {
      logger.copilot('Intent routing fallback', {
        reason: event.error,
        tier: event.tier,
      });
    }
  }

  /**
   * Get comprehensive telemetry statistics
   */
  getStats(): TelemetryStats {
    const total = this.events.length;

    if (total === 0) {
      return {
        total: 0,
        tier1: 0,
        tier2: 0,
        llm: 0,
        avgLatency: { tier1: 0, tier2: 0, llm: 0 },
        successRate: 0,
        tier1Coverage: 0,
        tier2Coverage: 0,
        llmFallback: 0,
        topTools: [],
        recentEvents: [],
      };
    }

    // Count by tier
    const tier1Events = this.events.filter((e) => e.tier === 1);
    const tier2Events = this.events.filter((e) => e.tier === 2);
    const llmEvents = this.events.filter((e) => e.tier === 3 || e.tier === 'llm');

    const tier1 = tier1Events.length;
    const tier2 = tier2Events.length;
    const llm = llmEvents.length;

    // Calculate average latencies
    const avgTier1 = this.calculateAvgLatency(tier1Events);
    const avgTier2 = this.calculateAvgLatency(tier2Events);
    const avgLLM = this.calculateAvgLatency(llmEvents);

    // Success rate
    const successful = this.events.filter((e) => e.success).length;
    const successRate = successful / total;

    // Coverage percentages
    const tier1Coverage = tier1 / total;
    const tier2Coverage = tier2 / total;
    const llmFallback = llm / total;

    // Top tools
    const toolCounts = new Map<string, number>();
    for (const event of this.events) {
      if (event.toolName) {
        toolCounts.set(event.toolName, (toolCounts.get(event.toolName) || 0) + 1);
      }
    }

    const topTools = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recent events
    const recentEvents = this.events.slice(-20);

    return {
      total,
      tier1,
      tier2,
      llm,
      avgLatency: {
        tier1: Math.round(avgTier1),
        tier2: Math.round(avgTier2),
        llm: Math.round(avgLLM),
      },
      successRate: Math.round(successRate * 100) / 100,
      tier1Coverage: Math.round(tier1Coverage * 100) / 100,
      tier2Coverage: Math.round(tier2Coverage * 100) / 100,
      llmFallback: Math.round(llmFallback * 100) / 100,
      topTools,
      recentEvents,
    };
  }

  /**
   * Calculate average latency for events
   */
  private calculateAvgLatency(events: TelemetryEvent[]): number {
    if (events.length === 0) return 0;
    const sum = events.reduce((acc, e) => acc + e.latency, 0);
    return sum / events.length;
  }

  /**
   * Generate a summary report
   */
  generateReport(): string {
    const stats = this.getStats();

    let report = '=== Intent Classification Telemetry Report ===\n\n';

    report += 'Overview:\n';
    report += `  Total Queries: ${stats.total}\n`;
    report += `  Success Rate: ${(stats.successRate * 100).toFixed(1)}%\n\n`;

    report += 'Tier Distribution:\n';
    report += `  Tier 1 (Pattern): ${stats.tier1} (${(stats.tier1Coverage * 100).toFixed(1)}%)\n`;
    report += `  Tier 2 (ML): ${stats.tier2} (${(stats.tier2Coverage * 100).toFixed(1)}%)\n`;
    report += `  LLM Fallback: ${stats.llm} (${(stats.llmFallback * 100).toFixed(1)}%)\n\n`;

    report += 'Average Latency:\n';
    report += `  Tier 1: ${stats.avgLatency.tier1}ms\n`;
    report += `  Tier 2: ${stats.avgLatency.tier2}ms\n`;
    report += `  LLM: ${stats.avgLatency.llm}ms\n\n`;

    if (stats.topTools.length > 0) {
      report += 'Top Tools:\n';
      for (const { tool, count } of stats.topTools) {
        report += `  ${tool}: ${count} times\n`;
      }
      report += '\n';
    }

    // Calculate cost savings
    const localHandled = stats.tier1 + stats.tier2;
    const costSavings = (localHandled / stats.total) * 100;
    report += 'Estimated Impact:\n';
    report += `  Queries Handled Locally: ${(costSavings).toFixed(1)}%\n`;
    report += `  Estimated Cost Reduction: ${(costSavings * 0.85).toFixed(1)}%\n`;
    report += `  Avg Latency Improvement: ${this.calculateLatencyImprovement(stats)}ms\n\n`;

    return report;
  }

  /**
   * Calculate latency improvement compared to always using LLM
   */
  private calculateLatencyImprovement(stats: TelemetryStats): number {
    const avgLocalLatency = (stats.tier1 * stats.avgLatency.tier1 + stats.tier2 * stats.avgLatency.tier2) / (stats.tier1 + stats.tier2 || 1);
    const assumedLLMLatency = 2000; // Assume 2 seconds for LLM
    return Math.round(assumedLLMLatency - avgLocalLatency);
  }

  /**
   * Clear all telemetry data
   */
  clear(): void {
    this.events = [];
    logger.copilot('Telemetry data cleared');
  }

  /**
   * Export telemetry data for analysis
   */
  export(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Log current statistics to console
   */
  logStats(): void {
    console.log(this.generateReport());
  }
}
