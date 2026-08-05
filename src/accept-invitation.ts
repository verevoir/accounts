import type { Member, Invitation } from './types.js';
import type { AccountStore } from './account-store.js';

/** Result of accepting an invitation. */
export interface AcceptResult {
  readonly invitation: Invitation;
  readonly member: Member;
}

/**
 * Accept an invitation by token. Validates the invitation is pending,
 * not expired, AND that `userEmail` matches the invited address (case
 * insensitive). Adds the user as a member and marks the invitation
 * accepted.
 *
 * The email match exists because the token alone is a bearer credential
 * — anyone who sees an invite link in screen-share, browser history, or
 * a Slack channel could otherwise join the account. The caller is
 * responsible for passing a verified email (e.g. from the OAuth claim).
 *
 * Returns the updated invitation and the new membership. Throws if the
 * token is invalid, already used, expired, or the email doesn't match.
 */
export async function acceptInvitation(
  store: AccountStore,
  token: string,
  userId: string,
  userEmail: string,
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

  if (
    invitation.email.trim().toLowerCase() !== userEmail.trim().toLowerCase()
  ) {
    throw new Error('Invitation was issued for a different email address');
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
