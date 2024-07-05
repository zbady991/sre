import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { StorageMetadata } from '@sre/types/Storage.types';
import { StorageConnector } from './StorageConnector';
import * as FileType from 'file-type';
import { isBuffer } from '@sre/utils';
import mime from 'mime';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
export type TSmythFSURI = {
    hash: string;
    team: string;
    path: string;
};

export class SmythFS {
    private storage: StorageConnector = SmythRuntime.Instance.Storage;

    //singleton
    private static instance: SmythFS;
    public static get Instance() {
        if (!this.instance) {
            this.instance = new SmythFS();
        }
        return this.instance;
    }

    private constructor() {
        //SmythFS cannot be used without SRE
        if (!SmythRuntime.Instance?.ready()) {
            throw new Error('SRE not available');
        }
    }

    private URIParser(uri: string) {
        const parts = uri.split('://');
        if (parts.length !== 2) return undefined;
        if (parts[0].toLowerCase() !== 'smythfs') return undefined;
        const parsed = new URL(`http://${parts[1]}`);

        return {
            hash: parsed.hash,
            team: parsed.hostname,
            path: parsed.pathname,
        };
    }
    public getStoragePath(uri: string) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        return `teams/${smythURI.team}${smythURI.path}`;
    }
    public async read(uri: string, candidate: IAccessCandidate) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        return await this.storage.user(_candidate).read(resourceId);
    }

    public async write(uri: string, data: any, candidate: IAccessCandidate, metadata?: StorageMetadata) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        const agentDataProvider = SmythRuntime.Instance.AgentData;
        const isMember = await agentDataProvider.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;
        //when we write a file, it does not exist we need to explicitly provide a resource team in order to have access rights set properly

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        const acl = new ACL()
            //.addAccess(candidate.role, candidate.id, TAccessLevel.Owner) // creator is owner
            .addAccess(TAccessRole.Team, smythURI.team, TAccessLevel.Read).ACL; // team has read access

        if (!metadata) metadata = {};
        if (!metadata?.ContentType) {
            metadata.ContentType = await this.getMimeType(data);
            if (!metadata.ContentType) {
                const ext: any = uri.split('.').pop();
                if (ext) {
                    metadata.ContentType = mime.getType(ext) || 'application/octet-stream';
                }
            }
        }
        await this.storage.user(_candidate).write(resourceId, data, acl, metadata);
    }
    private async getMimeType(data: any) {
        let size = 0;
        if (data instanceof Blob) return data.type;
        if (isBuffer(data)) {
            try {
                const fileType = await FileType.fileTypeFromBuffer(data);
                return fileType.mime;
            } catch {
                return '';
            }
        }

        if (typeof data === 'string') {
            return 'text/plain';
        }
    }

    public async delete(uri: string, candidate: IAccessCandidate) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        await this.storage.user(_candidate).delete(resourceId);
    }

    //TODO: should we require access token here ?
    public async exists(uri: string, candidate: IAccessCandidate) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        //in order to get a consistent access check in case of inexisting resource, we need to explicitly set a default resource team
        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        return await this.storage.user(_candidate).exists(resourceId);
    }
}
