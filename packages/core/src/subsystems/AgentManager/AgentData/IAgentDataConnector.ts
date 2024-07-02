import { AccessCandidate } from '@sre/Security/ACL.helper';

export interface IAgentDataConnector {
    getAgentData(agentId: string, version?: string): Promise<any>;
    getAgentIdByDomain(domain: string): Promise<string>;
    getAgentSettings(agentId: string, version?: string): Promise<any>;
    isTeamMember(team: string, candidate: AccessCandidate): Promise<boolean>;
    getCandidateTeam(candidate: AccessCandidate): Promise<string | undefined>;
}
