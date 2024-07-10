import Agent from '@sre/AgentManager/Agent.class';

export interface ILLMConnector {
    chatRequest(prompt, params: any, agent?: Agent): Promise<any>;
    visionRequest(prompt, params: any, agent?: Agent): Promise<any>;
    toolRequest(prompt, params: any, agent?: Agent): Promise<any>;
    extractLLMComponentParams(config): Promise<any>;
    //toolStreamRequest(prompt, model, params: any);
}
