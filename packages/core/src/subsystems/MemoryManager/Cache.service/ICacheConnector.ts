import { TACL, TAccessRequest } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';

export interface ICacheConnector {
    get: (key: string) => Promise<any>;
    set: (key: string, data: any, acl?: TACL, metadata?: CacheMetadata, ttl?: number) => Promise<boolean>;
    delete: (key: string) => Promise<void>;
    exists: (key: string) => Promise<boolean>;

    getMetadata: (key: string) => Promise<CacheMetadata | undefined>;
    setMetadata: (key: string, metadata: CacheMetadata) => Promise<void>;

    updateTTL: (key: string, ttl?: number) => Promise<void>;
    getTTL: (key: string) => Promise<number>;

    hasAccess: (request: TAccessRequest) => Promise<boolean>;
    getACL: (resourceId: string) => Promise<TACL | undefined>;
    setACL: (resourceId: string, acl: TACL) => Promise<void>;
}
