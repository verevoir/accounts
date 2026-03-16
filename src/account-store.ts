import type {
  Account,
  Member,
  MemberRole,
  Invitation,
  InvitationStatus,
  StorageAdapter,
} from './types.js';

const ACCOUNT = 'account';
const MEMBER = 'account-member';
const INVITATION = 'account-invitation';

export interface AccountStoreOptions {
  storage: StorageAdapter;
}

export interface AccountStore {
  // --- Accounts ---
  createAccount(name: string, ownerId: string): Promise<Account>;
  getAccount(accountId: string): Promise<Account | null>;

  // --- Members ---
  getMembers(accountId: string): Promise<Member[]>;
  getMemberships(userId: string): Promise<Member[]>;
  addMember(
    accountId: string,
    userId: string,
    role: MemberRole,
  ): Promise<Member>;
  setMemberRole(
    accountId: string,
    userId: string,
    role: MemberRole,
  ): Promise<Member>;
  removeMember(accountId: string, userId: string): Promise<void>;

  // --- Invitations ---
  createInvitation(
    accountId: string,
    email: string,
    role: MemberRole,
    invitedBy: string,
    token: string,
    expiresAt: number,
  ): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | null>;
  listInvitations(accountId: string): Promise<Invitation[]>;
  updateInvitationStatus(
    invitationId: string,
    status: InvitationStatus,
    acceptedBy?: string,
  ): Promise<Invitation>;
}

export function createAccountStore(options: AccountStoreOptions): AccountStore {
  const { storage } = options;

  return {
    // --- Accounts ---

    async createAccount(name: string, ownerId: string): Promise<Account> {
      const now = Math.floor(Date.now() / 1000);
      const doc = await storage.create(ACCOUNT, { name, createdAt: now });
      const account: Account = {
        id: doc.id,
        name,
        createdAt: now,
      };

      // Owner becomes first member
      await storage.create(MEMBER, {
        accountId: doc.id,
        userId: ownerId,
        role: 'owner',
        joinedAt: now,
      });

      return account;
    },

    async getAccount(accountId: string): Promise<Account | null> {
      const docs = await storage.list(ACCOUNT, {
        where: { id: accountId },
      });
      const doc = docs[0];
      if (!doc) return null;
      return {
        id: doc.id,
        name: doc.data.name as string,
        createdAt: doc.data.createdAt as number,
      };
    },

    // --- Members ---

    async getMembers(accountId: string): Promise<Member[]> {
      const docs = await storage.list(MEMBER, {
        where: { accountId },
      });
      return docs.map((doc) => ({
        accountId: doc.data.accountId as string,
        userId: doc.data.userId as string,
        role: doc.data.role as MemberRole,
        joinedAt: doc.data.joinedAt as number,
      }));
    },

    async getMemberships(userId: string): Promise<Member[]> {
      const docs = await storage.list(MEMBER, {
        where: { userId },
      });
      return docs.map((doc) => ({
        accountId: doc.data.accountId as string,
        userId: doc.data.userId as string,
        role: doc.data.role as MemberRole,
        joinedAt: doc.data.joinedAt as number,
      }));
    },

    async addMember(
      accountId: string,
      userId: string,
      role: MemberRole,
    ): Promise<Member> {
      // Check for existing membership
      const existing = await storage.list(MEMBER, {
        where: { accountId, userId },
      });
      if (existing.length > 0) {
        throw new Error(
          `User ${userId} is already a member of account ${accountId}`,
        );
      }

      const now = Math.floor(Date.now() / 1000);
      await storage.create(MEMBER, {
        accountId,
        userId,
        role,
        joinedAt: now,
      });
      return { accountId, userId, role, joinedAt: now };
    },

    async setMemberRole(
      accountId: string,
      userId: string,
      role: MemberRole,
    ): Promise<Member> {
      const docs = await storage.list(MEMBER, {
        where: { accountId, userId },
      });
      const doc = docs[0];
      if (!doc) {
        throw new Error(
          `User ${userId} is not a member of account ${accountId}`,
        );
      }
      const updated = await storage.update(doc.id, {
        ...doc.data,
        role,
      });
      return {
        accountId: updated.data.accountId as string,
        userId: updated.data.userId as string,
        role: updated.data.role as MemberRole,
        joinedAt: updated.data.joinedAt as number,
      };
    },

    async removeMember(accountId: string, userId: string): Promise<void> {
      const docs = await storage.list(MEMBER, {
        where: { accountId, userId },
      });
      const doc = docs[0];
      if (!doc) return;

      if (doc.data.role === 'owner') {
        throw new Error('Cannot remove the account owner');
      }
      await storage.delete(doc.id);
    },

    // --- Invitations ---

    async createInvitation(
      accountId: string,
      email: string,
      role: MemberRole,
      invitedBy: string,
      token: string,
      expiresAt: number,
    ): Promise<Invitation> {
      const now = Math.floor(Date.now() / 1000);
      const doc = await storage.create(INVITATION, {
        accountId,
        email,
        role,
        token,
        status: 'pending',
        invitedBy,
        createdAt: now,
        expiresAt,
      });
      return {
        id: doc.id,
        accountId,
        email,
        role,
        token,
        status: 'pending',
        invitedBy,
        createdAt: now,
        expiresAt,
      };
    },

    async getInvitationByToken(token: string): Promise<Invitation | null> {
      const docs = await storage.list(INVITATION, {
        where: { token },
      });
      const doc = docs[0];
      if (!doc) return null;
      return toInvitation(doc);
    },

    async listInvitations(accountId: string): Promise<Invitation[]> {
      const docs = await storage.list(INVITATION, {
        where: { accountId },
      });
      return docs.map(toInvitation);
    },

    async updateInvitationStatus(
      invitationId: string,
      status: InvitationStatus,
      acceptedBy?: string,
    ): Promise<Invitation> {
      // Read current state via list with ID filter
      const docs = await storage.list(INVITATION, {
        where: { id: invitationId },
      });
      const doc = docs[0];
      if (!doc) {
        throw new Error(`Invitation ${invitationId} not found`);
      }

      const data: Record<string, unknown> = { ...doc.data, status };
      if (acceptedBy != null) {
        data.acceptedBy = acceptedBy;
      }

      const updated = await storage.update(invitationId, data);
      return toInvitation(updated);
    },
  };
}

function toInvitation(doc: {
  id: string;
  data: Record<string, unknown>;
}): Invitation {
  return {
    id: doc.id,
    accountId: doc.data.accountId as string,
    email: doc.data.email as string,
    role: doc.data.role as MemberRole,
    token: doc.data.token as string,
    status: doc.data.status as InvitationStatus,
    invitedBy: doc.data.invitedBy as string,
    createdAt: doc.data.createdAt as number,
    expiresAt: doc.data.expiresAt as number,
    ...(doc.data.acceptedBy != null && {
      acceptedBy: doc.data.acceptedBy as string,
    }),
  };
}
