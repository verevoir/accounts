# @verevoir/accounts

Multi-user accounts, team membership, and invitations. The tenancy and billing boundary for SaaS applications.

Part of [Verevoir](https://verevoir.io) — a database-agnostic application platform.

## Install

```bash
npm install @verevoir/accounts
```

Zero runtime dependencies. Works with any `StorageAdapter`-compatible persistence layer.

## Quick Start

```typescript
import { createAccountStore, acceptInvitation } from '@verevoir/accounts';

const store = createAccountStore({ storage: myStorageAdapter });

// Create an account — creator becomes owner
const account = await store.createAccount('Acme Corp', 'user-1');

// Invite a colleague
await store.createInvitation(
  account.id, 'alice@example.com', 'admin', 'user-1', 'tok-abc', expiresAt,
);

// Alice accepts
const { member } = await acceptInvitation(store, 'tok-abc', 'user-alice');
```

## API

### Account Store

| Method | Description |
|--------|-------------|
| `createAccount(name, ownerId)` | Create account, creator becomes owner |
| `getAccount(accountId)` | Retrieve account by ID |
| `getMembers(accountId)` | List all members of an account |
| `getMemberships(userId)` | List all accounts a user belongs to |
| `addMember(accountId, userId, role)` | Add a member |
| `setMemberRole(accountId, userId, role)` | Change a member's role |
| `removeMember(accountId, userId)` | Remove a member (cannot remove owner) |
| `createInvitation(...)` | Create an email-based invitation |
| `getInvitationByToken(token)` | Look up invitation by token |
| `listInvitations(accountId)` | List all invitations for an account |
| `updateInvitationStatus(id, status)` | Change invitation status |

### Accept Flow

| Function | Description |
|----------|-------------|
| `acceptInvitation(store, token, userId)` | Validate, add member, mark accepted |

## Roles

- `owner` — account creator, cannot be removed
- `admin` — full management access
- `member` — standard team member

## Invitation Lifecycle

`pending` → `accepted` / `expired` / `revoked`

Expiry is checked at acceptance time. Expired invitations are marked automatically.

## Documentation

- [Verevoir Packages](https://verevoir.io/packages)
- [Access Control Guide](https://verevoir.io/docs/access-control)

## Development

```bash
make build   # Compile TypeScript
make test    # Run test suite
make lint    # Lint and check formatting
```

## License

MIT
