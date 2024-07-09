export interface ILLMConnector {
    chatRequest(prompt, params: any): Promise<any>;
    visionRequest(prompt, params: any): Promise<any>;
    toolRequest(prompt, params: any): Promise<any>;
    extractParams(config): Promise<any>;
    //toolStreamRequest(prompt, model, params: any);
}
