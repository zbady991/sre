import { Connector } from '@sre/Core/Connector.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { IAgentDataConnector } from '../IAgentDataConnector';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export abstract class AbstractAgentDataConnector extends Connector implements IAgentDataConnector {
    public abstract getAgentData(agentId: string, version?: string): Promise<any>;
    public abstract getAgentIdByDomain(domain: string): Promise<string>;
    public abstract getAgentSettings(agentId: string, version?: string): Promise<any>;

    public isTeamMember(team: string, candidate: AccessCandidate): Promise<boolean> {
        return Promise.resolve(true);
    }
    public getCandidateTeam(candidate: AccessCandidate): Promise<string | undefined> {
        return Promise.resolve('default');
    }
}
