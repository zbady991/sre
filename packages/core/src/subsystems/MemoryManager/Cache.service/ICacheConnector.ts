import { IACL, IAccessRequest } from '@sre/types/ACL.types';
import { CacheMetadata } from '@sre/types/Cache.types';

export interface ICacheConnector {
    get: (key: string) => Promise<any>;
    set: (key: string, data: any, acl?: IACL, metadata?: CacheMetadata, ttl?: number) => Promise<boolean>;
    delete: (key: string) => Promise<void>;
    exists: (key: string) => Promise<boolean>;

    getMetadata: (key: string) => Promise<CacheMetadata | undefined>;
    setMetadata: (key: string, metadata: CacheMetadata) => Promise<void>;

    updateTTL: (key: string, ttl?: number) => Promise<void>;
    getTTL: (key: string) => Promise<number>;

    hasAccess: (request: IAccessRequest) => Promise<boolean>;
    getACL: (resourceId: string) => Promise<IACL | undefined>;
    setACL: (resourceId: string, acl: IACL) => Promise<void>;
}
