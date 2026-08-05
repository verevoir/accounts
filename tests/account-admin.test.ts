import { describe, it, expect, beforeEach } from 'vitest';
import { createAccountStore } from '../src/account-store.js';
import {
  createAccountAdmin,
  AccountAdminError,
  requireRole,
} from '../src/account-admin.js';
import type { AccountStore } from '../src/account-store.js';
import type { AccountAdmin } from '../src/account-admin.js';
import { createMemoryStorage } from './helpers.js';

const oneDay = 86400;
const inOneDay = () => Math.floor(Date.now() / 1000) + oneDay;

describe('AccountAdmin', () => {
  let store: AccountStore;
  let admin: AccountAdmin;
  let accountId: string;

  beforeEach(async () => {
    store = createAccountStore({ storage: createMemoryStorage() });
    admin = createAccountAdmin({ store });
    const account = await store.createAccount('Acme', 'owner-1');
    accountId = account.id;
    await store.addMember(accountId, 'admin-1', 'admin');
    await store.addMember(accountId, 'member-1', 'member');
  });

  describe('inviteMember', () => {
    it('allows owner to invite', async () => {
      const inv = await admin.inviteMember(
        'owner-1',
        accountId,
        'new@example.com',
        'member',
        'tok-a',
        inOneDay(),
      );
      expect(inv.invitedBy).toBe('owner-1');
    });

    it('allows admin to invite', async () => {
      const inv = await admin.inviteMember(
        'admin-1',
        accountId,
        'new@example.com',
        'member',
        'tok-b',
        inOneDay(),
      );
      expect(inv.email).toBe('new@example.com');
    });

    it('rejects member with forbidden', async () => {
      await expect(
        admin.inviteMember(
          'member-1',
          accountId,
          'new@example.com',
          'member',
          'tok-c',
          inOneDay(),
        ),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'forbidden',
      });
    });

    it('rejects non-member with not-member', async () => {
      await expect(
        admin.inviteMember(
          'outsider',
          accountId,
          'new@example.com',
          'member',
          'tok-d',
          inOneDay(),
        ),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'not-member',
      });
    });
  });

  describe('setMemberRole', () => {
    it('admin can promote a member to admin', async () => {
      const updated = await admin.setMemberRole(
        'admin-1',
        accountId,
        'member-1',
        'admin',
      );
      expect(updated.role).toBe('admin');
    });

    it('member cannot promote themselves', async () => {
      await expect(
        admin.setMemberRole('member-1', accountId, 'member-1', 'admin'),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'forbidden',
      });
    });

    it('refuses to modify the owner', async () => {
      await expect(
        admin.setMemberRole('admin-1', accountId, 'owner-1', 'member'),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'cannot-modify-owner',
      });
    });
  });

  describe('removeMember', () => {
    it('admin can remove a member', async () => {
      await admin.removeMember('admin-1', accountId, 'member-1');
      const remaining = await store.getMembers(accountId);
      expect(remaining.find((m) => m.userId === 'member-1')).toBeUndefined();
    });

    it('member cannot remove another member', async () => {
      await store.addMember(accountId, 'member-2', 'member');
      await expect(
        admin.removeMember('member-1', accountId, 'member-2'),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'forbidden',
      });
    });

    it('member can remove themselves (self-leave)', async () => {
      await admin.removeMember('member-1', accountId, 'member-1');
      const remaining = await store.getMembers(accountId);
      expect(remaining.find((m) => m.userId === 'member-1')).toBeUndefined();
    });

    it('admin cannot remove the owner', async () => {
      await expect(
        admin.removeMember('admin-1', accountId, 'owner-1'),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'cannot-modify-owner',
      });
    });

    it('owner cannot self-leave (owner is immutable through this facade)', async () => {
      await expect(
        admin.removeMember('owner-1', accountId, 'owner-1'),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'cannot-modify-owner',
      });
    });
  });

  describe('revokeInvitation', () => {
    it('admin can revoke an invitation in their account', async () => {
      const inv = await admin.inviteMember(
        'admin-1',
        accountId,
        'soon@example.com',
        'member',
        'tok-rev-1',
        inOneDay(),
      );
      const revoked = await admin.revokeInvitation(
        'admin-1',
        accountId,
        inv.id,
      );
      expect(revoked.status).toBe('revoked');
    });

    it('refuses to revoke an invitation belonging to a different account', async () => {
      // Set up a second account with its own admin
      const other = await store.createAccount('Other Co', 'owner-2');
      await store.addMember(other.id, 'admin-2', 'admin');
      const otherInv = await admin.inviteMember(
        'owner-2',
        other.id,
        'them@example.com',
        'member',
        'tok-cross',
        inOneDay(),
      );

      // admin-1 (Acme) tries to revoke other account's invitation
      await expect(
        admin.revokeInvitation('admin-1', accountId, otherInv.id),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'not-found',
      });

      // The invitation in the other account is still pending.
      const fresh = await store.getInvitationByToken('tok-cross');
      expect(fresh?.status).toBe('pending');
    });

    it('member cannot revoke even an invitation in their own account', async () => {
      const inv = await admin.inviteMember(
        'admin-1',
        accountId,
        'who@example.com',
        'member',
        'tok-rev-2',
        inOneDay(),
      );
      await expect(
        admin.revokeInvitation('member-1', accountId, inv.id),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'forbidden',
      });
    });
  });

  describe('managerRoles override', () => {
    it('honours a stricter policy where only owner can manage', async () => {
      const ownerOnly = createAccountAdmin({
        store,
        managerRoles: ['owner'],
      });
      // Admin would be allowed under default — denied here.
      await expect(
        ownerOnly.inviteMember(
          'admin-1',
          accountId,
          'denied@example.com',
          'member',
          'tok-strict',
          inOneDay(),
        ),
      ).rejects.toMatchObject({
        name: 'AccountAdminError',
        code: 'forbidden',
      });
      // Owner still works.
      const inv = await ownerOnly.inviteMember(
        'owner-1',
        accountId,
        'allowed@example.com',
        'member',
        'tok-strict-ok',
        inOneDay(),
      );
      expect(inv.invitedBy).toBe('owner-1');
    });
  });
});

describe('requireRole', () => {
  it('returns the caller member when role is allowed', async () => {
    const store = createAccountStore({ storage: createMemoryStorage() });
    const acc = await store.createAccount('Acme', 'owner-1');
    const caller = await requireRole(
      store,
      acc.id,
      'owner-1',
      'owner',
      'admin',
    );
    expect(caller.userId).toBe('owner-1');
    expect(caller.role).toBe('owner');
  });

  it('throws AccountAdminError("forbidden") when role is not allowed', async () => {
    const store = createAccountStore({ storage: createMemoryStorage() });
    const acc = await store.createAccount('Acme', 'owner-1');
    await store.addMember(acc.id, 'm', 'member');
    await expect(
      requireRole(store, acc.id, 'm', 'owner', 'admin'),
    ).rejects.toBeInstanceOf(AccountAdminError);
  });

  it('throws AccountAdminError("not-member") when caller is not a member', async () => {
    const store = createAccountStore({ storage: createMemoryStorage() });
    const acc = await store.createAccount('Acme', 'owner-1');
    await expect(
      requireRole(store, acc.id, 'outsider', 'owner', 'admin'),
    ).rejects.toMatchObject({ code: 'not-member' });
  });
});
