# Intent — @verevoir/accounts

## Purpose

Provide multi-user account management — the tenancy and billing boundary for SaaS applications. Accounts group users into teams with roles, support email-based invitations, and serve as the entity against which subscriptions and features are scoped.

## Goals

- Account creation with automatic owner membership
- Team membership with roles (owner, admin, member)
- Email-based invitation flow with token acceptance, expiry, and revocation
- Per-user membership queries across accounts
- Composable with @verevoir/access for identity and @verevoir/commerce for subscriptions

## Non-goals

- Authentication — accounts consumes identities, it does not produce them
- Billing — subscriptions and payments live in commerce and stripe; accounts is the entity they attach to
- Feature entitlements — these are derived from the active subscription plan at query time, not stored on the account
- Multi-tenancy infrastructure — the library provides the tenancy boundary; the consumer implements data isolation

## Key design decisions

- **Members are separate documents.** Not embedded in accounts. Enables efficient per-user queries ("what accounts am I in?") without loading every account.
- **Structural StorageAdapter.** Same pattern as @verevoir/access role-store — no import from @verevoir/storage. Any compatible implementation works.
- **Invitation lifecycle is explicit.** Status is pending → accepted / expired / revoked. Expiry is checked at acceptance time and the invitation is marked.
- **Owner cannot be removed.** The account creator always has a membership. Ownership transfer requires explicit role reassignment.
- **Zero runtime dependencies.** Standalone library with structural typing.

## Constraints

- Zero runtime dependencies — all types defined locally
- No dependency on @verevoir/access — uses Identity structurally
- No dependency on @verevoir/storage — StorageAdapter is structural typing
- Invitation tokens are provided by the consumer (the library does not generate random tokens)
