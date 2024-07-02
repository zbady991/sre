import { ACL, AccessRequest } from '@sre/Security/ACL.helper';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IACL, IAccessCandidate, TAccessLevel, IAccessRequest } from '@sre/types/ACL.types';
import { StorageMetadata } from '@sre/types/Storage.types';

export abstract class StorageConnector extends SecureConnector {
    public abstract getResourceACL(request: AccessRequest): Promise<ACL>;
    public abstract read(resourceId: string, acRequest: AccessRequest): Promise<any>;
    public abstract write(resourceId: string, value: any, acRequest: AccessRequest, acl?: IACL, metadata?: StorageMetadata): Promise<void>;
    public abstract delete(resourceId: string, acRequest: AccessRequest): Promise<void>;
    public abstract exists(resourceId: string, acRequest: AccessRequest): Promise<boolean>;

    public abstract getMetadata(resourceId: string, acRequest: AccessRequest): Promise<StorageMetadata | undefined>;
    public abstract setMetadata(resourceId: string, metadata: StorageMetadata, acRequest: AccessRequest): Promise<void>;

    public abstract getACL(resourceId: string, acRequest: AccessRequest): Promise<ACL | undefined>;
    public abstract setACL(resourceId: string, acl: IACL, acRequest: AccessRequest): Promise<void>;
}
