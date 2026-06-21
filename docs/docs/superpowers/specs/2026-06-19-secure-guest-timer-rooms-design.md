# Secure Guest Timer Rooms Design

## Scope

Secure the Sync Timer room creation and room-admin authorization flow without requiring an account. This change covers server-generated room identifiers, trusted ownership, capability tokens, room-scoped socket authorization, aligned creation validation, and creation error feedback. Modal accessibility and the broader Settings UI redesign remain separate follow-up work.

## Goals

- Keep public and private room creation available to guests.
- Generate the six-character room ID on the server.
- Never trust client-supplied `id` or `ownerId` for authorization.
- Preserve account-owner convenience when the creator is authenticated.
- Make guest administration depend exclusively on the returned write capability.
- Prevent a writer in one room from mutating another room.
- Prevent tokens from an old room instance authorizing a later room that reuses the same short ID.
- Keep failed creation attempts in the form with actionable feedback.

## Non-Goals

- Requiring guest registration.
- Replacing short human-shareable room IDs.
- Redesigning the entire Create Room modal or Settings panel.
- Adding persistent room storage or durable token revocation records.
- Refactoring unrelated Socket.IO handlers.

## Chosen Architecture

Use a hybrid identity-and-capability model.

Authenticated creators are recognized through the verified account identity attached by optional HTTP or Socket.IO authentication. Guest creators have no trusted owner identity and administer the room with a write token. This retains account-owner recovery without allowing guest-controlled identifiers to grant privileges.

A capability-only model for all users was rejected because an authenticated owner would lose administrative access after losing the URL token. A separate signed guest-owner session was rejected as unnecessary complexity for in-memory timer rooms.

## Room Creation

`POST /api/rooms` remains publicly callable and adds optional authentication. It accepts only room settings: `name`, `defaultDurationMinutes`, `isPublic`, `visibleToFriends`, and `defaultRole`.

The server:

1. Generates a six-character lowercase alphanumeric room ID using cryptographically secure randomness.
2. Retries up to ten times if the ID is currently in use.
3. Generates an independent 128-bit cryptographically random room-generation value encoded as hexadecimal.
4. Sets `ownerId` to the verified `req.user.userId` for authenticated requests, otherwise `null`.
5. Creates the room exactly once.
6. Signs read and write tokens containing `roomId`, `role`, and the room-generation value.
7. Returns HTTP `201` with `{ id, readToken, writeToken }`.

If no free ID can be generated within ten attempts, the server returns HTTP `503` without creating a room or issuing tokens. Client-supplied `id` and `ownerId` are ignored even if present for backward compatibility during deployment.

## Token and Join Semantics

Every invite token is valid only when all of these match the current room:

- token signature;
- `roomId`;
- requested role (`read` or `write`);
- room-generation value.

An authenticated account matching the trusted room `ownerId` receives `write` access without an invite token. A guest-supplied `userId` is display/session metadata only and never grants ownership or a role.

Public joins without a valid capability receive the room's configured default role. Private joins require a valid current-room token unless the socket belongs to the authenticated owner.

Tokens generated later through the invite controls include the same room-generation value. Reusing a short ID after an old room expires therefore does not reactivate an old token.

## Room-Scoped Socket Authorization

Administrative Socket.IO handlers use one shared authorization helper. Given `socket`, `roomId`, and the required role, it:

1. Resolves the exact room.
2. Looks up the current socket in that room's `users` map.
3. Confirms the stored role is `write` when write access is required.
4. Returns the room member and room on success, otherwise emits the existing permission error and aborts.

The helper replaces global `getUserBySocket(socket.id)` role checks for room mutations. It applies to invite-token requests, timer actions, Pomodoro changes, auto-restart, room rename, promotion, and other room-admin operations that accept a caller-provided `roomId`.

Target validation remains operation-specific. For example, promotion must also confirm that the target socket belongs to the same room.

## Frontend Creation Flow

The Create Room client no longer generates or submits an ID and no longer submits `ownerId`. It checks `response.ok`, reads the server-returned `id`, and navigates only when both the ID and write token are present.

While the request is pending, the submit control is disabled to prevent duplicate creation. A server or network failure leaves the modal and entered values intact and shows an inline error. The minimum duration is one minute in both HTML constraints and API validation.

## Validation and Error Contracts

- `201`: room created; response contains `id`, `readToken`, and `writeToken`.
- `400`: invalid name, duration, visibility, or default role; client displays the returned validation error.
- `503`: the server could not allocate a free short ID after ten attempts.
- Socket permission failure: no mutation occurs and the caller receives the existing permission error event.
- Invalid, stale, or wrong-room capability: it never grants a role. Private-room joins fail; public-room joins fall back to the configured public role only when that fallback is otherwise allowed.

The server validates `defaultRole` as `read` or `write`, boolean visibility fields, a name of 1–30 characters, and duration from 1–120 minutes.

## Test Strategy

Development follows red-green-refactor. Tests must fail for the intended missing behavior before production code changes.

### Room Creation Tests

- Guest creation succeeds without an account and stores `ownerId: null`.
- Authenticated creation derives `ownerId` from `req.user`, ignoring the request body.
- Server output contains a six-character ID and matching tokens.
- Existing IDs are retried rather than reused.
- Exhausted allocation attempts return `503` and issue no token.
- Invalid `defaultRole`, booleans, name, and sub-minute duration return `400`.

### Token and Join Tests

- A guest creator joins as writer with the returned token.
- A forged guest `userId` matching an account owner does not grant write access.
- The authenticated owner joins as writer without a capability.
- A token for a different room or old room generation grants no privileged access.

### Socket Authorization Tests

- A writer can mutate the room in which its socket is a writer.
- A writer in room A cannot mutate room B or request room B invite tokens.
- Promotion fails when the target is not in the caller's room.
- Every migrated writer handler rejects a cross-room request without changing state.

### Frontend Tests

- The request body omits `id` and `ownerId`.
- Successful creation navigates with the server-returned ID and write token.
- Rejected creation preserves the form, shows the error, and does not navigate.
- The submit button prevents a second request while creation is pending.

## Rollout and Compatibility

The change is compatible with current callers because extra client fields are ignored. The bundled frontend switches to the new response `id` immediately. Existing in-memory rooms disappear on server restart as before, so no data migration is required.

Old invite tokens lacking the room-generation claim stop authorizing after deployment. This is an intentional security boundary. Deployment already restarts the in-memory room service, so pre-deployment rooms and their links expire together and require normal room recreation.

## Verification

Run the focused room creation, token, socket authorization, and frontend tests after each TDD cycle. Before completion, run the full Vitest suite and production build. Browser verification must cover guest creation, authenticated creation, rejected duration, double submission, valid writer controls, and a cross-room attack attempt with no state change.
