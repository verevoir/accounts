import type { AccountStore } from './account-store.js';
import type { Invitation, Member, MemberRole } from './types.js';

/**
 * Reasons an AccountAdmin operation can be refused.
 *
 * - `forbidden` — the caller does not have a sufficient role to perform
 *   the requested action against the target account.
 * - `not-member` — the caller is not a member of the target account at all.
 * - `cannot-modify-owner` — an attempt was made to demote or remove the
 *   account owner. Owners are immutable through this facade — recreate the
 *   account or transfer ownership first.
 * - `not-found` — the referenced invitation / member does not exist.
 */
export type AccountAdminErrorCode =
  'forbidden' | 'not-member' | 'cannot-modify-owner' | 'not-found';

/**
 * Thrown by AccountAdmin methods when a request is refused. Carries a
 * machine-readable `code` so consumers can map to HTTP statuses or UI
 * states without string-matching the message.
 */
export class AccountAdminError extends Error {
  readonly code: AccountAdminErrorCode;

  constructor(code: AccountAdminErrorCode, message: string) {
    super(message);
    this.name = 'AccountAdminError';
    this.code = code;
  }
}

export interface AccountAdminOptions {
  /** Underlying store that does the actual reads and writes. */
  store: AccountStore;
  /**
   * Roles permitted to mutate other members and invitations. Default:
   * `['owner', 'admin']`. Override to make the policy stricter
   * (e.g. `['owner']`) or — at your own risk — looser.
   */
  managerRoles?: readonly MemberRole[];
}

/**
 * Policy-enforcing facade over `AccountStore`.
 *
 * All mutations require an explicit `callerId` and check the caller's
 * role in the target account before delegating to the store. Use this
 * instead of `AccountStore` for any path that originates from a request
 * — so that authorisation lives in one place rather than every consumer
 * having to remember to add a guard.
 *
 * Read operations stay on the store: this facade is mutation-only.
 */
export interface AccountAdmin {
  /**
   * Create an invitation. Caller must be a manager of `accountId`.
   * `invitedBy` defaults to `callerId`.
   */
  inviteMember(
    callerId: string,
    accountId: string,
    email: string,
    role: MemberRole,
    token: string,
    expiresAt: number,
  ): Promise<Invitation>;

  /**
   * Revoke a pending invitation. Caller must be a manager of the
   * invitation's account. Throws `not-found` if the invitation doesn't
   * belong to `accountId` (prevents cross-account revocation by id).
   */
  revokeInvitation(
    callerId: string,
    accountId: string,
    invitationId: string,
  ): Promise<Invitation>;

  /**
   * Change `targetUserId`'s role within `accountId`. Caller must be a
   * manager. Throws `cannot-modify-owner` if the target is the owner.
   */
  setMemberRole(
    callerId: string,
    accountId: string,
    targetUserId: string,
    role: MemberRole,
  ): Promise<Member>;

  /**
   * Remove `targetUserId` from `accountId`. Caller must be a manager OR
   * `targetUserId === callerId` (self-leave). Throws
   * `cannot-modify-owner` if the target is the owner.
   */
  removeMember(
    callerId: string,
    accountId: string,
    targetUserId: string,
  ): Promise<void>;
}

const DEFAULT_MANAGER_ROLES: readonly MemberRole[] = ['owner', 'admin'];

/**
 * Resolve `callerId`'s membership in `accountId` and assert their role
 * is one of `allowed`. Throws `not-member` if the caller isn't in the
 * account, or `forbidden` if their role isn't in the allowed set.
 *
 * Exposed as a building block for consumers that have account-scoped
 * mutations of their own (e.g. tenant-owned resources stored outside
 * `@verevoir/accounts`).
 */
export async function requireRole(
  store: AccountStore,
  accountId: string,
  callerId: string,
  ...allowed: readonly MemberRole[]
): Promise<Member> {
  const members = await store.getMembers(accountId);
  const caller = members.find((m) => m.userId === callerId);
  if (!caller) {
    throw new AccountAdminError(
      'not-member',
      `User ${callerId} is not a member of account ${accountId}`,
    );
  }
  if (!allowed.includes(caller.role)) {
    throw new AccountAdminError(
      'forbidden',
      `User ${callerId} (role: ${caller.role}) is not authorised — requires one of: ${allowed.join(', ')}`,
    );
  }
  return caller;
}

export function createAccountAdmin(options: AccountAdminOptions): AccountAdmin {
  const { store } = options;
  const managerRoles = options.managerRoles ?? DEFAULT_MANAGER_ROLES;

  const requireManager = (accountId: string, callerId: string) =>
    requireRole(store, accountId, callerId, ...managerRoles);

  return {
    async inviteMember(callerId, accountId, email, role, token, expiresAt) {
      await requireManager(accountId, callerId);
      return store.createInvitation(
        accountId,
        email,
        role,
        callerId,
        token,
        expiresAt,
      );
    },

    async revokeInvitation(callerId, accountId, invitationId) {
      await requireManager(accountId, callerId);
      // Verify the invitation actually belongs to this account before
      // mutating — otherwise an admin in account A could revoke an
      // invitation in account B by id.
      const invitations = await store.listInvitations(accountId);
      const invitation = invitations.find((i) => i.id === invitationId);
      if (!invitation) {
        throw new AccountAdminError(
          'not-found',
          `Invitation ${invitationId} not found in account ${accountId}`,
        );
      }
      return store.updateInvitationStatus(invitationId, 'revoked');
    },

    async setMemberRole(callerId, accountId, targetUserId, role) {
      await requireManager(accountId, callerId);
      const members = await store.getMembers(accountId);
      const target = members.find((m) => m.userId === targetUserId);
      if (!target) {
        throw new AccountAdminError(
          'not-found',
          `User ${targetUserId} is not a member of account ${accountId}`,
        );
      }
      if (target.role === 'owner') {
        throw new AccountAdminError(
          'cannot-modify-owner',
          'Cannot change the owner role through AccountAdmin',
        );
      }
      return store.setMemberRole(accountId, targetUserId, role);
    },

    async removeMember(callerId, accountId, targetUserId) {
      // Self-leave: any member can remove themselves. Otherwise, must
      // be a manager.
      if (callerId !== targetUserId) {
        await requireManager(accountId, callerId);
      } else {
        // Even self-leave needs the caller to be a member of the
        // account — fall through requireRole with all roles allowed.
        await requireRole(
          store,
          accountId,
          callerId,
          'owner',
          'admin',
          'member',
        );
      }
      // Owner removal is blocked by the underlying store, but surface
      // the typed error here so consumers don't have to inspect the
      // generic Error message.
      const members = await store.getMembers(accountId);
      const target = members.find((m) => m.userId === targetUserId);
      if (target?.role === 'owner') {
        throw new AccountAdminError(
          'cannot-modify-owner',
          'Cannot remove the account owner',
        );
      }
      await store.removeMember(accountId, targetUserId);
    },
  };
}
