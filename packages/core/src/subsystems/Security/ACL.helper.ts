import { xxh3 } from '@node-rs/xxhash';
import {
    IAccessCandidate,
    IAccessRequest,
    LevelMap,
    ReverseLevelMap,
    ReverseRoleMap,
    RoleMap,
    IACL,
    TACLEntry,
    TAccessLevel,
    TAccessRole,
} from '@sre/types/ACL.types';
import { uid } from '@sre/utils/general.utils';

const ACLHashAlgo = {
    none: (source) => source,
    xxh3: (source) => xxh3.xxh64(source).toString(16),
};

export class ACL implements IACL {
    public hashAlgorithm?: string | undefined;
    public entries?: {
        [key in TAccessRole]?: TACLEntry | undefined;
    };
    public migrated?: boolean | undefined;
    //private acl: TACL;
    public get ACL(): IACL {
        return {
            hashAlgorithm: this.hashAlgorithm,
            entries: JSON.parse(JSON.stringify(this.entries)),
            migrated: this.migrated,
        };
    }
    public get serializedACL(): string {
        return this.serializeACL(this);
    }

    constructor(acl?: IACL | string) {
        if (typeof acl === 'string') {
            this.deserializeACL(acl);
        } else {
            this.hashAlgorithm = acl?.hashAlgorithm;
            this.entries = acl?.entries ? JSON.parse(JSON.stringify(acl?.entries)) : {};
            this.migrated = acl?.migrated;
        }
        if (!this.hashAlgorithm) this.hashAlgorithm = 'xxh3';
        if (!this.entries) this.entries = {};
    }

    static from(acl?: IACL | string): ACL {
        return new ACL(acl);
    }

    /**
     * This function checks if the candidate has access to the requested level
     * it only checks the exact access level, not the higher levels
     * Examples :
     * - if the candidate has read access, it will return true only if the requested level is read
     * - if the current ACL has team access but the candidate is an agent, it will not match the team access
     * @param acRequest
     * @returns
     */
    public checkExactAccess(acRequest: AccessRequest): boolean {
        if (!this?.entries) return false; // cannot determine the access rights, prefer to deny access

        const role = this?.entries[acRequest.candidate.role];
        if (!role) return false;
        let entryId = acRequest.candidate.id;

        if (!ACLHashAlgo[this.hashAlgorithm]) {
            throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
        }

        entryId = ACLHashAlgo[this.hashAlgorithm](entryId);

        const access = role[entryId];
        if (!access) return false;

        const levels = Array.isArray(acRequest.level) ? acRequest.level : [acRequest.level];

        return levels.every((level) => access.includes(level));
        //return access.includes(req.level);
    }

    public addAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACL {
        const _level = Array.isArray(level) ? level : [level];
        if (!this?.entries[role]) this.entries[role] = {};
        if (!ACLHashAlgo[this.hashAlgorithm]) {
            throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
        }
        const hashedOwner = ACLHashAlgo[this.hashAlgorithm](ownerId);

        if (!this?.entries[role]![hashedOwner]) this.entries[role]![hashedOwner] = [];
        //acl[role]![ownerId]!.push(level);
        //concatenate the levels
        const curLevel = this.entries[role]![hashedOwner]!;
        this.entries[role]![hashedOwner] = [...curLevel, ..._level];

        return this;
    }
    public static addAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACL {
        return ACL.from().addAccess(role, ownerId, level);
    }

    public removeAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACL {
        const _level = Array.isArray(level) ? level : [level];
        if (!this[role]) return this;
        if (!this[role]![ownerId]) return this;
        //acl[role]![ownerId] = acl[role]![ownerId]!.filter((l) => l !== level);
        //remove the levels
        const curLevel = this[role]![ownerId]!;
        this[role]![ownerId] = curLevel.filter((l) => !_level.includes(l));

        return this;
    }

    private serializeACL(tacl: IACL): string {
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

    private deserializeACL(compressed: string) {
        const parts = compressed.split('|');
        this.hashAlgorithm = '';
        this.entries = {};

        for (const part of parts) {
            if (part.startsWith('h:')) {
                this.hashAlgorithm = part.substring(2);
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

                    this.entries[role] = entriesObj;
                }
            }
        }

        //return tacl;
    }
}

export class AccessCandidate implements IAccessCandidate {
    public role: TAccessRole;
    public id: string;
    //public _candidate: TAccessCandidate;
    constructor(candidate?: IAccessCandidate) {
        //this._candidate = candidate || { role: TAccessRole.Public, id: '' };

        this.role = candidate ? candidate.role : TAccessRole.Public;
        this.id = candidate ? candidate.id : '';
    }

    public static from(candidate: IAccessCandidate): AccessCandidate {
        return new AccessCandidate(candidate);
    }

    public team(teamId: string): AccessCandidate {
        this.role = TAccessRole.Team;
        this.id = teamId;

        return this;
    }
    static team(teamId: string): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.Team, id: teamId });
    }

    public agent(agentId: string): AccessCandidate {
        this.role = TAccessRole.Agent;
        this.id = agentId;
        return this;
    }
    static agent(agentId: string): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.Agent, id: agentId });
    }

    public user(userId: string): AccessCandidate {
        this.role = TAccessRole.User;
        this.id = userId;
        return this;
    }
    static user(userId: string): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.User, id: userId });
    }

    public public(): AccessCandidate {
        this.role = TAccessRole.Public;
        this.id = '';

        return this;
    }
    static public(): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.Public, id: '' });
    }

    public makeRequest(): AccessRequest {
        return new AccessRequest(this);
    }
}

export class AccessRequest implements IAccessRequest {
    public id: string;
    public resourceId: string;
    public resourceTeamId?: string;
    public level: TAccessLevel[] = [];
    public candidate: AccessCandidate;

    constructor(object: AccessRequest | AccessCandidate) {
        if (['role', 'id'].every((k) => k in object)) {
            //this is a candidate
            this.id = 'aclR:' + uid();
            this.candidate = object as AccessCandidate;
        } else {
            const acReq: AccessRequest = object as AccessRequest;
            this.id = acReq.id;
            this.resourceId = acReq.resourceId;
            this.level = acReq.level;
            this.candidate = acReq.candidate;
            this.resourceTeamId = acReq.resourceTeamId;
        }
    }

    public static from(request: AccessRequest): AccessRequest {
        return new AccessRequest(request);
    }

    public read(resourceId?: string): AccessRequest {
        if (resourceId) this.resourceId = resourceId;
        this.level = [TAccessLevel.Read];
        return this;
    }

    public write(resourceId?: string): AccessRequest {
        if (resourceId) this.resourceId = resourceId;
        this.level = [TAccessLevel.Write];
        return this;
    }

    public owner(resourceId?: string): AccessRequest {
        if (resourceId) this.resourceId = resourceId;
        this.level = [TAccessLevel.Owner];
        return this;
    }

    public setCandidate(candidate: AccessCandidate): AccessRequest {
        this.candidate = candidate;

        return this;
    }

    public addRead(resourceId?: string): AccessRequest {
        if (resourceId) this.resourceId = resourceId;
        (this.level as TAccessLevel[]).push(TAccessLevel.Read);
        //deduplicate
        this.level = [...new Set(this.level)] as TAccessLevel[];

        return this;
    }

    public addWrite(resourceId?: string): AccessRequest {
        if (resourceId) this.resourceId = resourceId;
        (this.level as TAccessLevel[]).push(TAccessLevel.Write);
        //deduplicate
        this.level = [...new Set(this.level)] as TAccessLevel[];
        return this;
    }

    public addOwner(resourceId?: string): AccessRequest {
        if (resourceId) this.resourceId = resourceId;
        (this.level as TAccessLevel[]).push(TAccessLevel.Owner);
        //deduplicate
        this.level = [...new Set(this.level)] as TAccessLevel[];
        return this;
    }

    public resTeam(resourceTeamId: string): AccessRequest {
        this.resourceTeamId = resourceTeamId;
        return this;
    }
}

export function genACLTokenId() {
    return 'aclT:' + uid();
}
