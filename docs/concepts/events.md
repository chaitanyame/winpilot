# Events (Project Notes)

We subscribe to Copilot session events and forward relevant user-facing information to the renderer.

Project conventions:

- `assistant.message_delta` is streamed as text to the UI.
- Tool execution is surfaced as lightweight progress text.
- `session.idle` is treated as end-of-turn.

See: `src/copilot/client.ts` and `src/main/ipc.ts`
