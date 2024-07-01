import { Connector } from '@sre/Core/Connector.class';
import { TAccessCandidate } from '@sre/types/ACL.types';
import { IAgentDataConnector } from '../IAgentDataConnector';

export abstract class AbstractAgentDataConnector extends Connector implements IAgentDataConnector {
    public abstract getAgentData(agentId: string, version?: string): Promise<any>;
    public abstract getAgentIdByDomain(domain: string): Promise<string>;
    public abstract getAgentSettings(agentId: string, version?: string): Promise<any>;

    public isTeamMember(team: string, candidate: TAccessCandidate): Promise<boolean> {
        return Promise.resolve(true);
    }
    public getCandidateTeam(candidate: TAccessCandidate): Promise<string | undefined> {
        return Promise.resolve('default');
    }
}
