# Experimental Browser Multiplayer — Bring-up Notes

## Starting a browser-to-browser session

This branch now contains an experimental adapter between the existing CoopDX `NetworkSystem` interface and the page's shared `sm64webRelayTransport` WebSocket connection.

1. Start the local relay from `networking/relay` with `npm install` and `npm start`.
2. Open the same browser build on two clients. Set each page's Relay URL to the relay's WebSocket URL.
3. On the first client, click **Create room**, then **Start as host**.
4. On the second client, enter the room code, click **Join room**, then **Start as client**.
5. Check the game console and browser console for the CoopDX join handshake. A room join by itself is not proof of a game join.

The adapter is experimental and not yet verified as playable. Use the generated artifact from the **Browser multiplayer WebAssembly build** workflow; an older deployed Pages build will not contain the exported startup function or C adapter.

## Adapter behavior

- Uses the same JavaScript WebSocket transport instance as the room UI; it does not open a second socket.
- Calls the existing `network_init(NT_SERVER/NT_CLIENT)` and, for clients, the normal `network_send_join_request()`.
- Receives queued binary messages only during CoopDX's `NetworkSystem.update()` callback.
- On host, strips the relay's four-byte little-endian peer ID envelope before calling `network_receive()`; known peer IDs map to local peer-address handles.
- On client, treats received relay packets as server-originated and keeps the server address identity stable for address comparisons and reliable packet retries.
- Copies browser peer-address handles for reliable packet tracking and leaves the native UDP path unchanged.
- Preserves solo mode when no relay room is ready.

## Known gaps / validation gates

- The relay's `peer_left` control event is not yet wired to CoopDX's player-disconnect handling.
- No automatic relay room teardown is tied to game-session shutdown; leave the relay room explicitly after testing.
- Room capacity, cross-tab reconnection, ACK/reliable retransmission, ordered packets, player sync, and long-session behavior need end-to-end tests.
- A successful compile and relay packet test do not establish that two clients can play. Confirm the normal CoopDX join response and player-state synchronization before calling this playable.
- The local relay binds to loopback by default. Two devices need a relay reachable on the LAN and an appropriate host bind address; public deployment should use WSS and hardened admission/rate limits.
