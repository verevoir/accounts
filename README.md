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
  account.id,
  'alice@example.com',
  'admin',
  'user-1',
  'tok-abc',
  expiresAt,
);

// Alice accepts — her email must match the invited address. Pass a
// verified email (e.g. the OAuth claim), never one the client supplied.
const { member } = await acceptInvitation(
  store,
  'tok-abc',
  'user-alice',
  'alice@example.com',
);
```

For anything that originates from a request, prefer the `AccountAdmin`
facade over the raw store — it checks the caller's role before every
mutation, so authorisation lives in one place:

```typescript
import { createAccountAdmin, AccountAdminError } from '@verevoir/accounts';

const admin = createAccountAdmin({ store });

// Throws AccountAdminError('forbidden') unless user-1 manages the account
await admin.createInvitation(
  account.id,
  'user-1',
  'bob@example.com',
  'member',
  {
    token: 'tok-xyz',
    expiresAt,
  },
);
```

## API

### Account Store

| Method                                   | Description                           |
| ---------------------------------------- | ------------------------------------- |
| `createAccount(name, ownerId)`           | Create account, creator becomes owner |
| `getAccount(accountId)`                  | Retrieve account by ID                |
| `getMembers(accountId)`                  | List all members of an account        |
| `getMemberships(userId)`                 | List all accounts a user belongs to   |
| `addMember(accountId, userId, role)`     | Add a member                          |
| `setMemberRole(accountId, userId, role)` | Change a member's role                |
| `removeMember(accountId, userId)`        | Remove a member (cannot remove owner) |
| `createInvitation(...)`                  | Create an email-based invitation      |
| `getInvitationByToken(token)`            | Look up invitation by token           |
| `listInvitations(accountId)`             | List all invitations for an account   |
| `updateInvitationStatus(id, status)`     | Change invitation status              |

### Accept Flow

| Function                                            | Description                                            |
| --------------------------------------------------- | ------------------------------------------------------ |
| `acceptInvitation(store, token, userId, userEmail)` | Validate token, expiry **and email match**; add member |

The `userEmail` check exists because the token is a bearer credential on
its own — anyone who sees an invite link in a screen-share, browser
history, or a pasted Slack message could otherwise join the account.
Matching is case-insensitive and tolerates surrounding whitespace.

### Authorisation Facade

| Function                        | Description                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `createAccountAdmin({ store })` | Role-checking facade over the store; mutations only                                 |
| `requireRole(...)`              | Standalone guard for composing your own checks                                      |
| `AccountAdminError`             | Carries `code`: `forbidden` \| `not-member` \| `not-found` \| `cannot-modify-owner` |

## Roles

- `owner` — account creator, cannot be removed
- `admin` — full management access
- `member` — standard team member

## Invitation Lifecycle

`pending` → `accepted` / `expired` / `revoked`

Expiry is checked at acceptance time. Expired invitations are marked automatically.

## Where it sits

- **[@verevoir/access](https://www.npmjs.com/package/@verevoir/access)** — identity and policy. Use `identity.id` as the `userId` you pass into the account store.
- **[@verevoir/stripe](https://www.npmjs.com/package/@verevoir/stripe)** — subscription billing per account. The account is the billing boundary.
- **[@verevoir/storage](https://www.npmjs.com/package/@verevoir/storage)** — persistence. `createAccountStore({ storage })` works with any adapter.

## Docs

- [Verevoir packages](https://verevoir.io/packages)
- [Access control guide](https://verevoir.io/docs/access-control)

## License

MIT
