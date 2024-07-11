import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { IAccessCandidate } from '@sre/types/ACL.types';

export interface IAgentDataConnector {
    getAgentData(agentId: string, version?: string): Promise<any>;
    getAgentIdByDomain(domain: string): Promise<string>;
    getAgentSettings(agentId: string, version?: string): Promise<any>;
    isTeamMember(team: string, candidate: IAccessCandidate): Promise<boolean>;
    getCandidateTeam(candidate: IAccessCandidate): Promise<string | undefined>;
}
