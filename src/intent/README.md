# Intent Classification System

A hybrid intent classification system for WinPilot that combines pattern matching and machine learning to handle common queries locally, reducing LLM API calls by ~70% and improving response time from 2-3 seconds to <100ms.

## Architecture

### Three-Tier Classification Pipeline

```
User Query
    ↓
Tier 1: Pattern Matching (0-5ms, ~40% coverage)
    ├─> Exact match → Execute directly ✓
    └─> No match ↓

Tier 2: FastText ML Model (5-15ms, ~30% coverage)
    ├─> Confidence ≥ 0.85 → Execute directly ✓
    ├─> Confidence 0.60-0.85 → Extract params & execute ✓
    └─> Confidence < 0.60 ↓

Tier 3: LLM Fallback (2000ms, ~30% remaining)
    └─> Full reasoning → Execute ✓
```

## Components

### 1. Pattern Matcher (`patterns.ts`)
- Regex-based exact matching for deterministic queries
- Handles: "list windows", "system info", "what's my volume"
- Query patterns for simple queries
- Action patterns for parameterized queries

### 2. FastText Classifier (`ml-classifier.ts`)
- Handles variations, typos, paraphrasing
- Trained on synthetic + real user data
- Model size: ~20MB
- Inference time: 5-15ms

### 3. Parameter Extractor (`extractors.ts`)
- Numbers: "set volume to 50" → 50
- Time: "remind me in 30 minutes" → Date
- Targets: "focus chrome" → "chrome"

### 4. Intent Router (`router.ts`)
- Orchestrates classification pipeline
- Handles tool execution and fallback logic
- Tracks telemetry and performance metrics

### 5. Tool Executor (`executor.ts`)
- Executes tools locally without LLM
- Same response format as LLM execution
- Error handling and permission checks

### 6. Telemetry Manager (`telemetry.ts`)
- Tracks routing decisions and performance
- Monitors tier distribution and success rate
- Generates analytics reports

## Usage

### Basic Usage

```typescript
import { IntentRouter } from './intent';

const router = new IntentRouter();
await router.initialize();

const result = await router.route('list windows');
if (result.handled) {
  console.log(result.response); // Window list
} else {
  // Fall back to LLM
  console.log('Fallback reason:', result.reason);
}
```

### Training the ML Model

1. Generate training data:
```bash
npm run train:generate-data
```

2. Train the FastText model:
```bash
npm run train:model
```

3. Or do both at once:
```bash
npm run train:all
```

### Monitoring Performance

```typescript
const stats = router.getTelemetryStats();
console.log(`Tier 1 coverage: ${stats.tier1Coverage * 100}%`);
console.log(`Tier 2 coverage: ${stats.tier2Coverage * 100}%`);
console.log(`Avg Tier 1 latency: ${stats.avgLatency.tier1}ms`);
```

## Configuration

### Confidence Thresholds

Defined in `types.ts`:

```typescript
export const CONFIDENCE_THRESHOLDS = {
  PATTERN_MATCH: 0.95,      // Tier 1: Pattern matching
  ML_CLASSIFICATION: 0.85,  // Tier 2: ML model for direct execution
  ML_MEDIUM: 0.60,          // Tier 2: Medium confidence with param extraction
};
```

### Supported Tools

The system supports all 55+ tools defined in `src/tools/index.ts`. Coverage includes:

- Window management (list, focus, resize, close, etc.)
- System control (volume, brightness, WiFi, DND, etc.)
- File operations (list, search, move, copy, delete, etc.)
- Application control (launch, quit, switch)
- Productivity (timers, countdowns, pomodoro, reminders, world clock, unit converter)
- System information (system info, network info, process list)
- Clipboard operations (read, write, clear)
- And more...

## Performance Metrics

### Target Metrics
- **Coverage**: 65-70% queries handled locally
- **Latency**: <100ms for local execution (vs 2000ms LLM)
- **Accuracy**: >90% correct intent classification
- **False Positive Rate**: <5%

### Actual Results (After Training)

Run `router.getTelemetryStats()` to see live metrics:
- Tier distribution (% queries per tier)
- Average latency by tier
- Classification confidence distribution
- Fallback reasons

## Fallback Strategy

Aggressive fallback to LLM when:
- Pattern match confidence < 0.95
- ML classification confidence < 0.85
- Required parameters missing after extraction
- Multi-step queries detected (contains "and", "then")
- Context-dependent queries ("do that again")
- Ambiguous queries (multiple high-confidence intents)

## Development

### Adding New Patterns

Edit `patterns.ts`:

```typescript
export const QUERY_PATTERNS: Record<string, QueryPattern[]> = {
  my_new_tool: [
    { pattern: /^(my|pattern|here)/i, confidence: 0.96 },
  ],
};

export const ACTION_PATTERNS: Record<string, ActionPattern[]> = {
  my_new_tool: [
    {
      pattern: /^action (\d+)/i,
      extractor: (match) => ({ value: parseInt(match[1]) }),
      confidence: 0.95,
    },
  ],
};
```

### Adding Parameter Extractors

Edit `extractors.ts`:

```typescript
async extract(query: string, intent: string): Promise<ExtractedParams> {
  switch (intent) {
    case 'my_new_tool':
      return this.extractMyParams(query);
    // ...
  }
}

private extractMyParams(query: string): ExtractedParams {
  // Your extraction logic here
  return { param1: value1, param2: value2 };
}
```

### Running Tests

```bash
npm test
```

Tests are located in `src/intent/__tests__/`.

## Continuous Improvement

### Retraining with Real Data

1. Collect user queries and corrections from telemetry
2. Add to `training/training_data.txt`
3. Retrain model: `npm run train:model`
4. Monitor accuracy and adjust patterns/thresholds

### A/B Testing

Use telemetry to compare:
- Pattern improvements
- Confidence threshold changes
- New tools/extractors

### Analytics

Export telemetry for analysis:

```typescript
const events = router.getTelemetry().export();
// Analyze with external tools
```

## Troubleshooting

### ML Model Not Loading

If you see "Model file not found":
1. Check if `models/intent_model.ftz` exists
2. Run `npm run train:all` to generate and train
3. Verify `fasttext-node` is installed: `npm install fasttext-node`

### Low Coverage

If local handling is < 65%:
1. Check telemetry: `router.getTelemetryStats()`
2. Review fallback reasons in logs
3. Add more patterns for common queries
4. Retrain ML model with more examples

### High False Positive Rate

If wrong tool is executed:
1. Increase confidence thresholds in `types.ts`
2. Refine patterns to be more specific
3. Add more training examples for ambiguous cases

## License

MIT
