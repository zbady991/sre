import { TAccessCandidate } from '@sre/types/ACL.types';

export interface IAgentDataConnector {
    getAgentData(agentId: string, version?: string): Promise<any>;
    getAgentIdByDomain(domain: string): Promise<string>;
    getAgentSettings(agentId: string, version?: string): Promise<any>;
    isTeamMember(team: string, candidate: TAccessCandidate): Promise<boolean>;
    getCandidateTeam(candidate: TAccessCandidate): Promise<string | undefined>;
}
