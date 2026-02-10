# SDK Types (Project Notes)

We rely on SDK session event payloads for:

- streaming deltas (`assistant.message_delta`)
- tool execution start/complete events
- idle/error events

Implementation: `src/copilot/client.ts`
