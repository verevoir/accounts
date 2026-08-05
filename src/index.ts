// Types
export type {
  Account,
  Member,
  MemberRole,
  Invitation,
  InvitationStatus,
  StorageAdapter,
} from './types.js';

// Account store
export type { AccountStore, AccountStoreOptions } from './account-store.js';
export { createAccountStore } from './account-store.js';

// Invitation flow
export type { AcceptResult } from './accept-invitation.js';
export { acceptInvitation } from './accept-invitation.js';

// Authorisation facade — preferred entry point for any path that
// originates from a request. Wraps the store with caller role checks.
export type {
  AccountAdmin,
  AccountAdminOptions,
  AccountAdminErrorCode,
} from './account-admin.js';
export {
  AccountAdminError,
  createAccountAdmin,
  requireRole,
} from './account-admin.js';
