# sm64web local multiplayer relay

This is the first networking layer for browser multiplayer. It provides private room codes and routes binary WebSocket messages without changing their payloads. It is a development relay, not yet wired into the game's C networking system.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```sh
cd networking/relay
npm install
npm test
npm start
```

The relay listens on `ws://127.0.0.1:8787` by default. Check `http://127.0.0.1:8787/health` for a JSON health response.

Set `PORT` to change the port. Set `MAX_PLAYERS` to change room capacity (2–16).

## Control messages

Create a room by sending JSON:

```json
{"type":"create"}
```

The host receives `room_created` with a six-character `roomCode`.

Join a room:

```json
{"type":"join","roomCode":"ABC234"}
```

The client receives `room_joined`. Invalid codes, full rooms, and invalid controls receive an `error` message with a short code.

Send game data as **binary WebSocket messages**. Client binary messages are routed to the room host; host binary messages are routed to all room clients. The relay does not inspect or rewrite packet bytes.

## Important limits

- This relay does not yet connect to the CoopDX `NetworkSystem`; the game-side browser transport is the next step.
- Host disconnect closes the room. Host migration is not implemented.
- Bind address defaults to loopback for local development. Do not expose this unauthenticated development service publicly.
- The transport currently limits binary packets to 3000 bytes to match the current CoopDX packet buffer.
