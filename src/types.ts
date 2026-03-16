/** A member's role within an account. */
export type MemberRole = 'owner' | 'admin' | 'member';

/** Invitation lifecycle status. */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/** An account — the tenancy and billing boundary. */
export interface Account {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
}

/** A member of an account — stored as a separate document for independent query. */
export interface Member {
  readonly accountId: string;
  readonly userId: string;
  readonly role: MemberRole;
  readonly joinedAt: number;
}

/** An invitation to join an account. */
export interface Invitation {
  readonly id: string;
  readonly accountId: string;
  readonly email: string;
  readonly role: MemberRole;
  readonly token: string;
  readonly status: InvitationStatus;
  readonly invitedBy: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly acceptedBy?: string;
}

/** Structural storage adapter — same pattern as @verevoir/access role-store. No import. */
export interface StorageAdapter {
  create(
    blockType: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; data: Record<string, unknown> }>;
  list(
    blockType: string,
    options?: { where?: Record<string, unknown> },
  ): Promise<{ id: string; data: Record<string, unknown> }[]>;
  update(
    id: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; data: Record<string, unknown> }>;
  delete(id: string): Promise<void>;
}
