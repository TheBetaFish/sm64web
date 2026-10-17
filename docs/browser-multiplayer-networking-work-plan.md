# Browser Multiplayer Networking Work Plan

This document defines the implementation order for browser multiplayer in sm64web. It is a networking-first workflow, not a claim that multiplayer currently works. The initial target is browser-to-browser play through a local relay, with existing CoopDX packet payloads preserved wherever possible.

## Current constraints found in the source

- The web build currently compiles with `COOPNET=0` in `.github/workflows/webassembly.yml`.
- `src/pc/network/socket/socket.c` uses native UDP calls (`sendto` / `recvfrom`) and stores peer addresses in `sAddr[MAX_PLAYERS]`.
- Its `__EMSCRIPTEN__` branch only bypasses transport for a solo server; it is not a browser multiplayer implementation.
- `struct NetworkSystem` in `src/pc/network/network.h` is the integration seam: initialize, ID/address operations, update, send, and shutdown.
- `network_send_to()` in `src/pc/network/network.c` compresses packets before calling `gNetworkSystem->send()`. The transport therefore receives compressed packet bytes; it must not compress them again.
- Reliable-packet tracking duplicates an address using `network_duplicate_address(localIndex)`. Browser peer identity must therefore be stable and safely duplicable for the lifetime of queued/retried packets.
- CoopDX's join handshake assigns player slots. The relay must not independently assign CoopDX player indices.

## Design decisions

1. **Transport:** WebSocket messages between browser clients and a relay. Browsers cannot create arbitrary UDP sockets.
2. **Packet payload:** Carry the exact byte sequence handed to `NetworkSystem.send` as one binary WebSocket message. Do not prepend relay metadata to the CoopDX packet bytes; use relay framing outside the payload or separate control messages.
3. **Address abstraction:** Introduce an owned browser-peer/address handle rather than reusing `sockaddr_in6`. Its identity must distinguish the server connection from individual remote peers and remain valid while reliable packets retain a duplicate.
4. **Room layer:** Relay owns private room codes, membership, connection lifecycle, and routing only. It does not interpret gameplay packets or allocate player slots.
5. **Handshake:** The existing CoopDX join request/join response remains authoritative. A successful WebSocket room join is only transport readiness, not a successful in-game join.
6. **Scope:** Local relay first; no accounts, public room browser, voice, persistence, host migration, or public deployment in the first pass.
7. **Crossplay:** Native UDP CoopDX compatibility is not assumed. It requires a separate UDP/WebSocket gateway or a native transport path and must be evaluated after browser-to-browser packets work.

## Implementation workflow

### Phase 1 — Finish the transport contract (read-only audit)
- Trace `network_receive()`, packet compression/decompression, and the full `NetworkSystem` address lifecycle.
- Confirm how `localIndex`, `addr`, and `PACKET_DESTINATION_SERVER/BROADCAST` interact for server and client sends.
- Inspect the Emscripten build flags and available WebSocket API support.
- Record packet size limits, disconnect semantics, and which packet types depend on address matching.

**Exit condition:** The send/receive contract and address ownership rules are written down; no transport code is guessed.

### Phase 2 — Add an isolated local relay
- Add a small standalone relay service, separate from the game build.
- Implement create-room, join-room-by-code, leave-room, and disconnect cleanup.
- Route binary messages only among connections in the same room.
- Enforce a maximum room size, message-size limits, and basic rate limits.
- Add a small test client or automated relay tests so room routing can be tested without compiling the game.

**Exit condition:** Two test clients can create/join a private room and exchange binary messages; room isolation and disconnect cleanup are tested.

### Phase 3 — Implement the browser transport adapter
- Add a browser-specific network system or transport implementation behind the existing `NetworkSystem` seam.
- Use either Emscripten's WebSocket API or a narrow JavaScript bridge, selected after checking the existing toolchain and main-loop constraints.
- Queue incoming binary messages and drain them from the normal network update callback; do not call game packet processing from arbitrary browser callbacks unless the threading/reentrancy model is proven safe.
- Define ownership and cleanup for peer handles, queued buffers, and WebSocket close/error events.
- Keep the native UDP implementation unchanged.

**Exit condition:** A browser build can connect to the local relay and send/receive test binary payloads without involving CoopDX gameplay.

### Phase 4 — Connect the CoopDX packet path
- Select the browser network system when browser multiplayer is enabled; retain solo mode as a separate option.
- Deliver received binary messages through `network_receive(localIndex, addr, data, length)` with a consistent peer mapping.
- Ensure reliable retransmissions resolve the same peer after address duplication.
- Verify server relay routing preserves each client's identity and does not confuse local array indices with CoopDX global player indices.
- Confirm the relay does not modify compressed packet bytes.

**Exit condition:** A browser client completes the actual CoopDX join handshake through the relay and receives the expected player assignment.

### Phase 5 — Validate gameplay synchronization
- Test server/client connection and disconnect.
- Test player state packets, ping/pong, keepalive, ACK/reliable retransmission, and ordered packets.
- Test level/area filtering and server forwarding.
- Test malformed/oversized messages, reconnects, room-full behavior, and one client closing its tab.
- Compare behavior against native CoopDX where the transport model permits a meaningful comparison.

**Exit condition:** Two browser clients can join the same hosted game and exchange player-state updates reliably over a sustained session.

### Phase 6 — Add room-code UI and deployment
- Add create/join room UI only after the transport and game handshake are verified.
- Keep relay URL configurable for local development.
- Deploy the static web game and persistent WebSocket relay separately; static hosting alone cannot run the relay.
- Require WSS in production and add server-side room expiry, capacity limits, logging that avoids secrets, and abuse controls.

**Exit condition:** Users can create a private room, share a code, join, and play on the deployed service.

## First test matrix

| Test | What it proves |
|---|---|
| Relay unit test: create room / join with valid code | Room membership works |
| Invalid code / full room | Admission failures are handled |
| Binary payload round-trip | Message boundaries and bytes are preserved |
| Room A cannot receive Room B traffic | Room isolation works |
| Client disconnect cleanup | Stale members and peers are removed |
| Browser transport connect / send / receive | Browser API integration works independently of game logic |
| CoopDX join request and join response | Actual game handshake works |
| Reliable packet retry after a delayed ACK | Peer handles survive packet retention |
| Player state sync between two clients | End-to-end gameplay networking works |

## Explicit non-goals for the first implementation

- Do not rewrite CoopDX packet payloads.
- Do not make the relay simulate the game.
- Do not let the relay allocate CoopDX player indices.
- Do not claim native-client crossplay until the UDP/WebSocket boundary is implemented and tested.
- Do not mix transport bring-up with unrelated rendering, input, save/load, or UI fixes.
- Do not treat a successful web build as proof that networking works.

## Phase 1 audit results (source-confirmed)

- `NetworkSystem.send` receives the compressed packet returned by `packet_compress()`; `network_receive()` expects that compressed byte sequence and performs decompression and hash validation itself.
- The native socket implementation copies the server's address into `sAddr[localIndex]` through `save_id()`. Reliable retries call `network_duplicate_address(localIndex)`, so a browser address object must be owned, copyable, and comparable; it cannot be a pointer to a transient JavaScript event buffer.
- The server accepts initial join/control packet types from `UNKNOWN_LOCAL_INDEX`. Once the join handshake identifies a player, CoopDX's own `network_player_connected()` and `save_id()` path must remain responsible for assigning and associating player slots.
- `packet_receive()` sends ACKs before processing most packet types and validates the source address against `gNetworkServerAddr` on clients. Browser transport must preserve a stable server address identity for host-originated packets and reliable retransmissions.
- For this transport's server-broadcast model, clients send gameplay packets to the host; the host forwards/broadcasts through CoopDX's normal packet path. The relay's peer-ID envelope is relay framing only and must be removed before `network_receive()`. The peer ID must map to a stable per-connection address handle, not directly to a CoopDX global player index.
- The current Emscripten workflow uses Emscripten 3.1.64 and does not enable a WebSocket API flag or compile a browser transport. The existing browser solo path is a no-op transport branch inside `socket.c`; native UDP code should stay unchanged.
- `network_init()` calls the selected system's `initialize()` synchronously, while WebSocket readiness and room membership are asynchronous. A bridge therefore needs explicit states (disconnected, connecting, room-ready, failed/closed) and must not report transport initialization complete until the socket and requested room operation have succeeded.
- The relay currently accepts binary payloads up to 3000 bytes. Client-to-host messages add a four-byte little-endian relay peer ID outside the CoopDX payload; host-to-client messages are forwarded without that envelope. The host adapter must validate and strip the four-byte envelope before delivering bytes to CoopDX.

## Implementation gate before writing the C adapter

Do not select the browser transport merely because the room UI has a WebSocket connection. The game and UI must share one transport lifecycle; otherwise the UI can create a room on one socket while CoopDX sends through another. The next implementation should first introduce a single JavaScript-owned relay connection/queue API, then add the C adapter that consumes it from `NetworkSystem.update()`. The adapter should be isolated behind `__EMSCRIPTEN__`, preserve the native socket implementation, and have tests for binary queue ordering, peer-handle duplication/matching, and close/error cleanup before it is selected by normal game initialization.

