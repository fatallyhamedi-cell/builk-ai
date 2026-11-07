import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessageText = error instanceof Error ? error.message : String(error);
  const errorCode = (error as any)?.code || '';
  const isOffline = errorMessageText.toLowerCase().includes('offline') || 
                    errorMessageText.toLowerCase().includes('network') ||
                    errorMessageText.toLowerCase().includes('unavailable') ||
                    errorCode === 'unavailable' ||
                    errorCode === 'failed-precondition';

  const errInfo: FirestoreErrorInfo = {
    error: errorMessageText,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  
  const jsonError = JSON.stringify(errInfo);

  if (isOffline) {
    console.info('Firestore is operating in offline mode:', errorMessageText);
  } else {
    console.error('Firestore Error: ', jsonError);
  }

  // Still throw for permission errors so rules can be debugged,
  // but be gentler with network/offline errors.
  if (!isOffline || errorMessageText.toLowerCase().includes('permission')) {
    throw new Error(jsonError);
  }
}
