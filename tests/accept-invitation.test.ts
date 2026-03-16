import { describe, it, expect, beforeEach } from 'vitest';
import { createAccountStore } from '../src/account-store.js';
import { acceptInvitation } from '../src/accept-invitation.js';
import type { AccountStore } from '../src/account-store.js';
import { createMemoryStorage } from './helpers.js';

const now = Math.floor(Date.now() / 1000);
const oneDay = 86400;

describe('acceptInvitation', () => {
  let store: AccountStore;
  let accountId: string;

  beforeEach(async () => {
    store = createAccountStore({ storage: createMemoryStorage() });
    const account = await store.createAccount('Acme', 'owner-1');
    accountId = account.id;
  });

  it('accepts a valid invitation and adds the user as a member', async () => {
    await store.createInvitation(
      accountId,
      'alice@example.com',
      'member',
      'owner-1',
      'tok-1',
      now + oneDay,
    );

    const result = await acceptInvitation(store, 'tok-1', 'user-alice', now);

    expect(result.invitation.status).toBe('accepted');
    expect(result.invitation.acceptedBy).toBe('user-alice');
    expect(result.member.userId).toBe('user-alice');
    expect(result.member.role).toBe('member');
    expect(result.member.accountId).toBe(accountId);

    const members = await store.getMembers(accountId);
    expect(members).toHaveLength(2);
  });

  it('preserves the invited role', async () => {
    await store.createInvitation(
      accountId,
      'bob@example.com',
      'admin',
      'owner-1',
      'tok-2',
      now + oneDay,
    );

    const result = await acceptInvitation(store, 'tok-2', 'user-bob', now);
    expect(result.member.role).toBe('admin');
  });

  it('throws for invalid token', async () => {
    await expect(
      acceptInvitation(store, 'nonexistent', 'user-1', now),
    ).rejects.toThrow('Invalid invitation token');
  });

  it('throws for already accepted invitation', async () => {
    await store.createInvitation(
      accountId,
      'a@x.com',
      'member',
      'owner-1',
      'tok-3',
      now + oneDay,
    );
    await acceptInvitation(store, 'tok-3', 'user-a', now);

    await expect(
      acceptInvitation(store, 'tok-3', 'user-b', now),
    ).rejects.toThrow('already been accepted');
  });

  it('throws for revoked invitation', async () => {
    const inv = await store.createInvitation(
      accountId,
      'a@x.com',
      'member',
      'owner-1',
      'tok-4',
      now + oneDay,
    );
    await store.updateInvitationStatus(inv.id, 'revoked');

    await expect(
      acceptInvitation(store, 'tok-4', 'user-a', now),
    ).rejects.toThrow('already been revoked');
  });

  it('throws and marks as expired when past expiry', async () => {
    await store.createInvitation(
      accountId,
      'a@x.com',
      'member',
      'owner-1',
      'tok-5',
      now - 60,
    );

    await expect(
      acceptInvitation(store, 'tok-5', 'user-a', now),
    ).rejects.toThrow('expired');

    // Should be marked as expired in the store
    const inv = await store.getInvitationByToken('tok-5');
    expect(inv!.status).toBe('expired');
  });
});
