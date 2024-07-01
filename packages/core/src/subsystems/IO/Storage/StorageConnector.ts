import { AccessRequest } from '@sre/Security/ACL.helper';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { TACL, TAccessCandidate, TAccessLevel, TAccessRequest } from '@sre/types/ACL.types';
import { StorageMetadata } from '@sre/types/Storage.types';

export abstract class StorageConnector extends SecureConnector {
    public abstract getResourceACL(request: TAccessRequest | AccessRequest): Promise<TACL>;
    public abstract read(resourceId: string, acRequest: TAccessRequest | AccessRequest): Promise<any>;
    public abstract write(
        resourceId: string,
        value: any,
        acRequest: TAccessRequest | AccessRequest,
        acl?: TACL,
        metadata?: StorageMetadata
    ): Promise<void>;
    public abstract delete(resourceId: string, acRequest: TAccessRequest | AccessRequest): Promise<void>;
    public abstract exists(resourceId: string, acRequest: TAccessRequest | AccessRequest): Promise<boolean>;

    public abstract getMetadata(resourceId: string, acRequest: TAccessRequest | AccessRequest): Promise<StorageMetadata | undefined>;
    public abstract setMetadata(resourceId: string, metadata: StorageMetadata, acRequest: TAccessRequest | AccessRequest): Promise<void>;

    public abstract getACL(resourceId: string, acRequest: TAccessRequest | AccessRequest): Promise<TACL | undefined>;
    public abstract setACL(resourceId: string, acl: TACL, acRequest: TAccessRequest | AccessRequest): Promise<void>;
}
