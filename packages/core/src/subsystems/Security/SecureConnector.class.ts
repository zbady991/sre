import { IAgentDataConnector } from '@sre/AgentManager/AgentData/IAgentDataConnector';
import { Connector } from '@sre/Core/Connector.class';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { IACL, TAccessLevel, IAccessRequest, TAccessResult, TAccessTicket } from '@sre/types/ACL.types';
import { ACL, AccessCandidate, AccessRequest } from './ACL.helper';

//const _ConnectorAccessTokens = {};

export abstract class SecureConnector extends Connector {
    public abstract name: string;

    //this determines the access rights for the requested resource
    //the connector should check if the resource exists or not
    //if the resource exists we read it's ACL and return it
    //if the resource does not exist we return an write access ACL for the candidate
    public abstract getResourceACL(acRequest: AccessRequest): Promise<ACL>;

    public async start() {
        console.info(`Starting ${this.name} connector ...`);
    }

    public async stop() {
        console.info(`Stopping ${this.name} connector ...`);
    }

    private async hasAccess(acRequest: AccessRequest) {
        const aclHelper = await this.getResourceACL(acRequest);

        //const aclHelper = ACLHelper.from(acl);

        const exactAccess = aclHelper.checkExactAccess(acRequest);
        if (exactAccess) return true;

        // if the exact access is denied, we check if the candidate has a higher access
        const ownerRequest = AccessRequest.from(acRequest).owner();
        const ownerAccess = aclHelper.checkExactAccess(ownerRequest);
        if (ownerAccess) return true;

        // if the exact access is denied, we check if the requested resource has a public access
        const publicRequest = AccessRequest.from(acRequest).setCandidate(AccessCandidate.public());
        const publicAccess = aclHelper.checkExactAccess(publicRequest);
        if (publicAccess) return true;

        // if the public access is denied, we check if the candidate's team has access
        const agentDataConnector = SmythRuntime.Instance.AgentData as IAgentDataConnector;
        const teamId = await agentDataConnector.getCandidateTeam(acRequest.candidate);
        const teamRequest = AccessRequest.from(acRequest).setCandidate(AccessCandidate.team(teamId));
        const teamAccess = aclHelper.checkExactAccess(teamRequest);
        if (teamAccess) return true;

        return false;
    }
    public async getAccessTicket(request: AccessRequest): Promise<TAccessTicket> {
        const accessTicket = {
            request,
            access: (await this.hasAccess(request)) ? TAccessResult.Granted : TAccessResult.Denied,
        };

        return accessTicket as TAccessTicket;
    }
}
