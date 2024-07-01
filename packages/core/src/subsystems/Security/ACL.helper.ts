import {
    LevelMap,
    ReverseLevelMap,
    ReverseRoleMap,
    RoleMap,
    TACL,
    TACLEntry,
    TAccessCandidate,
    TAccessLevel,
    TAccessRequest,
    TAccessRole,
} from '@sre/types/ACL.types';
import { xxh3 } from '@node-rs/xxhash';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { IAgentDataConnector } from '@sre/AgentManager/AgentData/IAgentDataConnector';
import { uid } from '@sre/utils/general.utils';
import { T } from 'vitest/dist/reporters-yx5ZTtEV';
export class ACLHelper {
    private acl: TACL;
    public get ACL(): TACL {
        return this.acl;
    }
    public get serializedACL(): string {
        return this.serializeACL(this.acl);
    }

    constructor(acl?: TACL | string) {
        if (typeof acl === 'string') {
            this.acl = this.deserializeACL(acl);
        } else {
            this.acl = acl || {};
        }
        if (!this.acl.hashAlgorithm) this.acl.hashAlgorithm = 'xxh3';
        if (!this.acl.entries) this.acl.entries = {};
    }

    static load(acl?: TACL | string): ACLHelper {
        return new ACLHelper(acl);
    }

    /**
     * This function checks if the candidate has access to the requested level
     * it only checks the exact access level, not the higher levels
     * Examples :
     * - if the candidate has read access, it will return true only if the requested level is read
     * - if the current ACL has team access but the candidate is an agent, it will not match the team access
     * @param request
     * @returns
     */
    public checkExactAccess(request: TAccessRequest | AccessRequest): boolean {
        const req = request instanceof AccessRequest ? request.request : request;
        if (!this.acl?.entries) return false; // cannot determine the access rights, prefer to deny access

        const role = this.acl?.entries[req.candidate.role];
        if (!role) return false;
        let entryId = req.candidate.id;
        switch (this.acl.hashAlgorithm) {
            case '':
            case 'none':
            case 'raw':
                entryId = req.candidate.id;
                break;
            case 'xxh3':
                entryId = xxh3.xxh64(req.candidate.id).toString(16);
                break;
            default:
                throw new Error(`Hash algorithm ${this.acl.hashAlgorithm} not supported`);
                break;
        }

        const access = role[entryId];
        if (!access) return false;

        const levels = Array.isArray(req.level) ? req.level : [req.level];

        return levels.every((level) => access.includes(level));
        //return access.includes(req.level);
    }

    public addAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACLHelper {
        const _level = Array.isArray(level) ? level : [level];
        this.acl = this.addAccessRight(role, ownerId, _level, this.acl);
        return this;
    }

    public removeAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACLHelper {
        const _level = Array.isArray(level) ? level : [level];
        this.acl = this.removeAccessRight(role, ownerId, _level, this.acl);
        return this;
    }

    public get(): TACL {
        return this.acl;
    }

    private addAccessRight(role: TAccessRole, ownerId: string, level: TAccessLevel[], acl?: TACL): TACL {
        if (!acl?.entries) return {};
        if (!acl?.entries[role]) acl.entries[role] = {};
        const hashedOwner = xxh3.xxh64(ownerId).toString(16);
        if (!acl?.entries[role]![hashedOwner]) acl.entries[role]![hashedOwner] = [];
        //acl[role]![ownerId]!.push(level);
        //concatenate the levels
        const curLevel = acl.entries[role]![hashedOwner]!;
        acl.entries[role]![hashedOwner] = [...curLevel, ...level];

        return acl;
    }

    private removeAccessRight(role: TAccessRole, ownerId: string, level: TAccessLevel[], acl?: TACL): TACL {
        if (!acl) return {};
        if (!acl[role]) return acl;
        if (!acl[role]![ownerId]) return acl;
        //acl[role]![ownerId] = acl[role]![ownerId]!.filter((l) => l !== level);
        //remove the levels
        const curLevel = acl[role]![ownerId]!;
        acl[role]![ownerId] = curLevel.filter((l) => !level.includes(l));

        return acl;
    }

    private serializeACL(tacl: TACL): string {
        let compressed = '';

        if (tacl.hashAlgorithm) {
            compressed += `h:${tacl.hashAlgorithm}|`;
        }

        if (tacl.entries) {
            for (const [role, entries] of Object.entries(tacl.entries)) {
                const roleShort = RoleMap[role]; // Use the mapping for role
                const entriesArray: any[] = [];

                for (const [hashedOwnerKey, accessLevels] of Object.entries(entries || {})) {
                    if (accessLevels) {
                        const accessLevelsShort = accessLevels.map((level) => LevelMap[level]).join('');
                        entriesArray.push(`${hashedOwnerKey}/${accessLevelsShort}`);
                    }
                }

                if (entriesArray.length > 0) {
                    compressed += `${roleShort}:${entriesArray.join(',')}|`;
                }
            }
        }

        // Remove the trailing '|'
        if (compressed.endsWith('|')) {
            compressed = compressed.slice(0, -1);
        }

        return compressed;
    }

    private deserializeACL(compressed: string): TACL {
        const parts = compressed.split('|');
        const tacl = {
            hashAlgorithm: '',
            entries: {},
        };

        for (const part of parts) {
            if (part.startsWith('h:')) {
                tacl.hashAlgorithm = part.substring(2);
            } else {
                const [roleShort, entries] = part.split(':');
                const role = ReverseRoleMap[roleShort]; // Use the reverse mapping for role

                if (role) {
                    const entriesObj = {};
                    const entriesArray = entries.split(',');

                    for (const entry of entriesArray) {
                        const [hashedOwnerKey, accessLevelsShort] = entry.split('/');
                        const accessLevels = accessLevelsShort.split('').map((short) => ReverseLevelMap[short]);

                        entriesObj[hashedOwnerKey] = accessLevels;
                    }

                    tacl.entries[role] = entriesObj;
                }
            }
        }

        return tacl;
    }
}

export class AccessCandidate {
    static team(teamId: string): TAccessCandidate {
        return {
            role: TAccessRole.Team,
            id: teamId,
        };
    }
    static agent(agentId: string): TAccessCandidate {
        return {
            role: TAccessRole.Agent,
            id: agentId,
        };
    }
    static user(userId: string): TAccessCandidate {
        return {
            role: TAccessRole.User,
            id: userId,
        };
    }

    static public(): TAccessCandidate {
        return {
            role: TAccessRole.Public,
            id: 'public',
        };
    }
}

export class AccessRequest {
    private _request: TAccessRequest;

    constructor(object: TAccessRequest | TAccessCandidate) {
        if (['role', 'id'].every((k) => k in object)) {
            //this is a candidate
            this._request = {
                id: 'aclR:' + uid(),
                resourceId: '',
                level: TAccessLevel.None,
                candidate: object as TAccessCandidate,
            };
        } else {
            this._request = object as TAccessRequest;
        }
    }

    public get request(): TAccessRequest {
        return this._request;
    }

    public read(resourceId: string) {
        this._request.resourceId = resourceId;
        this._request.level = TAccessLevel.Read;
        return this;
    }

    public write(resourceId: string) {
        this._request.resourceId = resourceId;
        this._request.level = TAccessLevel.Write;

        return this;
    }

    public resTeam(resourceTeamId: string) {
        this._request.resourceTeamId = resourceTeamId;
        return this;
    }
}

export function genACLTokenId() {
    return 'aclT:' + uid();
}
