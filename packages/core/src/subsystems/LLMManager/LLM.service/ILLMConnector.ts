export interface ILLMConnector {
    chatRequest(prompt, model, params: any): Promise<any>;
    visionRequest(prompt, model, params: any): Promise<any>;
    toolRequest(prompt, model, params: any): Promise<any>;
    extractParams(config): Promise<any>;
    //toolStreamRequest(prompt, model, params: any);
}
