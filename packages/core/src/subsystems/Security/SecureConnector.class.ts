import { Connector } from '@sre/Core/Connector.class';
import { TACL, TAccessCandidate, TAccessLevel, TAccessRequest, TAccessResult, TAccessTicket, TConnectorAccessToken } from '@sre/types/ACL.types';
import { AccessCandidate, AccessRequest, ACLHelper, genACLTokenId } from './ACL.helper';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { IAgentDataConnector } from '@sre/AgentManager/AgentData/IAgentDataConnector';

//const _ConnectorAccessTokens = {};

export abstract class SecureConnector extends Connector {
    public abstract name: string;

    //this determines the access rights for the requested resource
    //the connector should check if the resource exists or not
    //if the resource exists we read it's ACL and return it
    //if the resource does not exist we return an write access ACL for the candidate
    public abstract getResourceACL(request: TAccessRequest | AccessRequest): Promise<TACL>;

    public async start() {
        console.info(`Starting ${this.name} connector ...`);
    }

    public async stop() {
        console.info(`Stopping ${this.name} connector ...`);
    }

    private async hasAccess(request: TAccessRequest | AccessRequest) {
        const req = request instanceof AccessRequest ? request.request : request;
        const acl = await this.getResourceACL(request);

        const aclHelper = ACLHelper.load(acl);

        const exactAccess = aclHelper.checkExactAccess(request);
        if (exactAccess) return true;

        // if the exact access is denied, we check if the candidate has a higher access
        const ownerRequest = { ...req, level: TAccessLevel.Owner };
        const ownerAccess = aclHelper.checkExactAccess(ownerRequest);
        if (ownerAccess) return true;

        // if the exact access is denied, we check if the requested resource has a public access
        const publicRequest = { ...req, candidate: AccessCandidate.public() };
        const publicAccess = aclHelper.checkExactAccess(publicRequest);
        if (publicAccess) return true;

        // if the public access is denied, we check if the candidate's team has access
        const agentDataConnector = SmythRuntime.Instance.AgentData as IAgentDataConnector;
        const teamId = await agentDataConnector.getCandidateTeam(req.candidate);
        const teamRequest = { ...req, candidate: AccessCandidate.team(teamId) };
        const teamAccess = aclHelper.checkExactAccess(teamRequest);
        if (teamAccess) return true;

        return false;
    }
    public async getAccessTicket(request: TAccessRequest | AccessRequest): Promise<TAccessTicket> {
        const accessTicket = {
            request: request instanceof AccessRequest ? request.request : request,
            access: request && (await this.hasAccess(request)) ? TAccessResult.Granted : TAccessResult.Denied,
        };

        return accessTicket as TAccessTicket;
    }
    // private generateAccessToken(request: TAccessRequest | AccessRequest, ttl: number = 60): string {
    //     const req = request instanceof AccessRequest ? request.request : request;

    //     const connectorToken: TConnectorAccessToken = {
    //         request: req,
    //         tokenId: genACLTokenId(),
    //         expires: Date.now() + ttl * 1000,
    //     };

    //     _ConnectorAccessTokens[connectorToken.tokenId] = connectorToken;

    //     //TODO: do we need to handle this with Cache.service instead ?
    //     setTimeout(() => {
    //         delete _ConnectorAccessTokens[connectorToken.tokenId];
    //     }, ttl * 1000);

    //     return connectorToken.tokenId;
    // }

    // public async getAccess(request: TAccessRequest | AccessRequest, ttl: number = 60) {
    //     if (await this.hasAccess(request)) {
    //         return this.generateAccessToken(request, ttl);
    //     }
    // }

    // public checkToken(tokenId: string, accessLevel: TAccessLevel): TAccessCandidate | undefined {
    //     const connectorToken = _ConnectorAccessTokens[tokenId];
    //     if (!connectorToken) return undefined;
    //     if (connectorToken.expires < Date.now()) return undefined;
    //     if (connectorToken.request.level === accessLevel) return connectorToken.request.candidate;
    //     return undefined;
    // }
}
