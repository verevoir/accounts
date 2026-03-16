import type { Member, Invitation } from './types.js';
import type { AccountStore } from './account-store.js';

/** Result of accepting an invitation. */
export interface AcceptResult {
  readonly invitation: Invitation;
  readonly member: Member;
}

/**
 * Accept an invitation by token. Validates the invitation is pending and not
 * expired, adds the user as a member, and marks the invitation as accepted.
 *
 * Returns the updated invitation and the new membership.
 * Throws if the token is invalid, already used, or expired.
 */
export async function acceptInvitation(
  store: AccountStore,
  token: string,
  userId: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<AcceptResult> {
  const invitation = await store.getInvitationByToken(token);

  if (!invitation) {
    throw new Error('Invalid invitation token');
  }

  if (invitation.status !== 'pending') {
    throw new Error(`Invitation has already been ${invitation.status}`);
  }

  if (now >= invitation.expiresAt) {
    // Mark as expired before throwing
    await store.updateInvitationStatus(invitation.id, 'expired');
    throw new Error('Invitation has expired');
  }

  const member = await store.addMember(
    invitation.accountId,
    userId,
    invitation.role,
  );

  const updated = await store.updateInvitationStatus(
    invitation.id,
    'accepted',
    userId,
  );

  return { invitation: updated, member };
}
