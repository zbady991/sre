import Agent from '@sre/AgentManager/Agent.class';

export interface ILLMConnector {
    chatRequest(prompt, params: any, agent?: Agent): Promise<any>;
    visionRequest(prompt, params: any, agent?: Agent): Promise<any>;
    toolRequest(params: any): Promise<any>;
    extractLLMComponentParams(config): Promise<any>;
    extractVisionLLMParams(config: any): Promise<any>;
    postProcess(response: any): any;
    enhancePrompt(prompt: string, config: any): string;
    formatToolsConfig({ type, toolDefinitions, toolChoice });
    //toolStreamRequest(prompt, model, params: any);
}
