# @verevoir/accounts — Multi-User Accounts & Invitations

Multi-user accounts, team membership, invitations, and the tenancy boundary for billing and features. Standalone — works with or without Verevoir.

## What It Does

- **Account** — the billing and tenancy boundary. Has a name and a creation timestamp.
- **Members** — links identities to accounts with roles (owner, admin, member). Stored independently for efficient query.
- **Invitations** — email-based invitation flow with token acceptance, expiry, and revocation.

## Design Principles

- **Structural StorageAdapter** — same pattern as `@verevoir/access` role-store. No import required.
- **Members are separate documents** — not embedded in accounts. Enables efficient per-user membership queries.
- **Invitation lifecycle** — pending → accepted / expired / revoked. Expiry is checked at acceptance time.
- **Owner cannot be removed** — the account creator is always a member.
- **Zero runtime dependencies** — standalone library.

## Quick Example

```typescript
import { createAccountStore, acceptInvitation } from '@verevoir/accounts';

const store = createAccountStore({ storage: myStorageAdapter });

// Create an account — creator becomes owner
const account = await store.createAccount('Acme Corp', 'user-1');

// Invite a colleague
const invitation = await store.createInvitation(
  account.id, 'alice@example.com', 'admin', 'user-1', 'tok-abc', expiresAt,
);

// Alice accepts
const { member } = await acceptInvitation(store, 'tok-abc', 'user-alice');
// member.role === 'admin'
```

## Setup

```bash
npm install
```

## Commands

```bash
make build   # Compile TypeScript
make test    # Run test suite
make lint    # Lint and check formatting
make run     # No-op (library)
```

## Architecture

- `src/types.ts` — Core interfaces: Account, Member, MemberRole, Invitation, InvitationStatus, StorageAdapter
- `src/account-store.ts` — `createAccountStore()` — CRUD for accounts, members, and invitations
- `src/accept-invitation.ts` — `acceptInvitation()` — validates and accepts an invitation, adds member
- `src/index.ts` — Public API exports

## Dependencies

- **Zero runtime dependencies** — all types defined locally
- **No** dependency on `@verevoir/access` — uses Identity structurally
- **No** dependency on `@verevoir/storage` — StorageAdapter is structural typing
