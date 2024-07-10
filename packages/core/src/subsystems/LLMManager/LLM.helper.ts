import { ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { LLMConnector } from './LLM.service/connectors/LLMConnector.class';
import models from './models';
import Agent from '@sre/AgentManager/Agent.class';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';

export function getLLMConnector(model): LLMConnector {
    return ConnectorService.Instance.getInstance(TConnectorService.LLM, models[model]?.llm);
}

export async function componentLLMRequest(prompt, model, config: any = {}, agent: Agent) {
    const llmName = models[model]?.llm;
    const modelId = models[model]?.alias || model;
    const llmConnector: LLMConnector = ConnectorService.Instance.getInstance(TConnectorService.LLM, llmName);
    if (!llmConnector) return { error: 'LLM request failed', details: `Model ${model} not supported` };

    const params: any = await llmConnector.extractLLMComponentParams(config);
    params.model = modelId;

    try {
        let response = await llmConnector.chatRequest(prompt, params, agent);
        response = llmConnector.postProcess(response);
        return response;
    } catch (error: any) {
        return { error: 'LLM request failed', details: error?.message || error?.toString() };
    }
}

export async function visionLLMRequest(prompt, sources: BinaryInput[], model, config: any = {}, agent: Agent) {
    const llmName = models[model]?.llm;
    const modelId = models[model]?.alias || model;
    const llmConnector: LLMConnector = ConnectorService.Instance.getInstance(TConnectorService.LLM, llmName);
    if (!llmConnector) return { error: 'LLM request failed', details: `Model ${model} not supported` };

    const params: any = await llmConnector.extractVisionLLMParams(config);
    params.model = modelId;
    params.sources = sources;

    try {
        let response = await llmConnector.visionRequest(prompt, params, agent);
        response = llmConnector.postProcess(response);
        return response;
    } catch (error: any) {
        return { error: 'LLM request failed', details: error?.message || error?.toString() };
    }
}
