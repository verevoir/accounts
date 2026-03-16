import { describe, it, expect, beforeEach } from 'vitest';
import { createAccountStore } from '../src/account-store.js';
import type { AccountStore } from '../src/account-store.js';
import { createMemoryStorage } from './helpers.js';

describe('createAccountStore', () => {
  let store: AccountStore;

  beforeEach(() => {
    store = createAccountStore({ storage: createMemoryStorage() });
  });

  // --- Accounts ---

  describe('accounts', () => {
    it('creates an account with the creator as owner', async () => {
      const account = await store.createAccount('Acme Corp', 'user-1');
      expect(account.name).toBe('Acme Corp');
      expect(account.id).toBeDefined();
      expect(account.createdAt).toBeGreaterThan(0);

      const members = await store.getMembers(account.id);
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe('user-1');
      expect(members[0].role).toBe('owner');
    });

    it('retrieves an account by ID', async () => {
      const created = await store.createAccount('Acme Corp', 'user-1');
      const fetched = await store.getAccount(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('Acme Corp');
    });

    it('returns null for unknown account', async () => {
      const fetched = await store.getAccount('nonexistent');
      expect(fetched).toBeNull();
    });
  });

  // --- Members ---

  describe('members', () => {
    it('adds a member to an account', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      const member = await store.addMember(account.id, 'user-2', 'member');
      expect(member.userId).toBe('user-2');
      expect(member.role).toBe('member');
      expect(member.accountId).toBe(account.id);

      const members = await store.getMembers(account.id);
      expect(members).toHaveLength(2);
    });

    it('throws when adding duplicate member', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      await expect(
        store.addMember(account.id, 'owner-1', 'admin'),
      ).rejects.toThrow('already a member');
    });

    it('changes a member role', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      await store.addMember(account.id, 'user-2', 'member');
      const updated = await store.setMemberRole(account.id, 'user-2', 'admin');
      expect(updated.role).toBe('admin');
    });

    it('throws when setting role for non-member', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      await expect(
        store.setMemberRole(account.id, 'stranger', 'admin'),
      ).rejects.toThrow('not a member');
    });

    it('removes a member', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      await store.addMember(account.id, 'user-2', 'member');
      await store.removeMember(account.id, 'user-2');

      const members = await store.getMembers(account.id);
      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe('owner-1');
    });

    it('prevents removing the owner', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      await expect(store.removeMember(account.id, 'owner-1')).rejects.toThrow(
        'Cannot remove the account owner',
      );
    });

    it('removing non-member is a no-op', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      await store.removeMember(account.id, 'stranger'); // should not throw
      const members = await store.getMembers(account.id);
      expect(members).toHaveLength(1);
    });

    it('lists memberships for a user across accounts', async () => {
      const a1 = await store.createAccount('Acme', 'user-1');
      const a2 = await store.createAccount('Globex', 'user-2');
      await store.addMember(a2.id, 'user-1', 'member');

      const memberships = await store.getMemberships('user-1');
      expect(memberships).toHaveLength(2);
      expect(memberships.map((m) => m.accountId).sort()).toEqual(
        [a1.id, a2.id].sort(),
      );
    });
  });

  // --- Invitations ---

  describe('invitations', () => {
    it('creates and retrieves an invitation by token', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      const inv = await store.createInvitation(
        account.id,
        'alice@example.com',
        'member',
        'owner-1',
        'tok-abc',
        Math.floor(Date.now() / 1000) + 86400,
      );

      expect(inv.status).toBe('pending');
      expect(inv.email).toBe('alice@example.com');
      expect(inv.token).toBe('tok-abc');

      const found = await store.getInvitationByToken('tok-abc');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(inv.id);
    });

    it('returns null for unknown token', async () => {
      const found = await store.getInvitationByToken('nonexistent');
      expect(found).toBeNull();
    });

    it('lists invitations for an account', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      await store.createInvitation(
        account.id,
        'a@x.com',
        'member',
        'owner-1',
        'tok-1',
        999999999,
      );
      await store.createInvitation(
        account.id,
        'b@x.com',
        'admin',
        'owner-1',
        'tok-2',
        999999999,
      );

      const invitations = await store.listInvitations(account.id);
      expect(invitations).toHaveLength(2);
    });

    it('updates invitation status', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      const inv = await store.createInvitation(
        account.id,
        'a@x.com',
        'member',
        'owner-1',
        'tok-1',
        999999999,
      );

      const revoked = await store.updateInvitationStatus(inv.id, 'revoked');
      expect(revoked.status).toBe('revoked');
    });

    it('updates invitation with acceptedBy', async () => {
      const account = await store.createAccount('Acme', 'owner-1');
      const inv = await store.createInvitation(
        account.id,
        'a@x.com',
        'member',
        'owner-1',
        'tok-1',
        999999999,
      );

      const accepted = await store.updateInvitationStatus(
        inv.id,
        'accepted',
        'user-2',
      );
      expect(accepted.status).toBe('accepted');
      expect(accepted.acceptedBy).toBe('user-2');
    });

    it('throws when updating nonexistent invitation', async () => {
      await expect(
        store.updateInvitationStatus('nonexistent', 'revoked'),
      ).rejects.toThrow('not found');
    });
  });
});
