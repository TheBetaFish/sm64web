# Browser Multiplayer Networking — Current Status

## Milestone #28

This milestone hardens the JavaScript WebSocket transport and adds a real relay-to-client integration test. It does **not** connect the transport to CoopDX's C `NetworkSystem` yet.

### Changes in this milestone

- Validate control messages before updating room state.
- Reject empty and oversized outbound packets; the CoopDX payload limit is 3000 bytes.
- Bound queued inbound packets to 128 and queued events to 256 to avoid unbounded growth when the game loop is not draining the bridge.
- Treat the client-to-host four-byte little-endian peer ID as relay framing. The maximum inbound WebSocket message is therefore 3004 bytes on the host path.
- Add a real WebSocket integration test against an ephemeral local relay: create room, join client, verify peer ID envelope and byte-exact packet delivery in both directions.
- Keep native UDP transport untouched.

## Current integration boundary

The page's lobby UI still owns its own WebSocket lifecycle; the exported `sm64webRelayTransport` module is tested independently. Do not treat lobby readiness as game-network readiness. Before gameplay integration, unify the lobby and transport around one connection or define a clean handoff, then implement an Emscripten-only `NetworkSystem` adapter with owned peer handles and main-loop queue draining.

## Next technical work

1. Reconcile UI room actions with the bridge so the room created by the UI is the same connection used by the game adapter.
2. Implement and compile the browser-specific address handle lifecycle (`dup_addr`, `match_addr`, ID save/clear).
3. Add an Emscripten main-loop drain that passes stripped CoopDX packet bytes to `network_receive()` only after peer/source mapping is resolved.
4. Enable browser networking behind an explicit experimental build/runtime switch; preserve solo mode and native socket code.
5. Validate real CoopDX join, ACK/reliable/ordered packets, and two-client player-state sync before claiming playable multiplayer.

## Acceptance checks

- Relay tests pass.
- Browser transport tests pass.
- Real relay integration test passes with byte-exact client-to-host and host-to-client payloads.
- WebAssembly build and end-to-end game handshake remain separate acceptance gates.
