import Agent from '@sre/AgentManager/Agent.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { DEFAULT_MAX_TOKENS_FOR_LLM } from '@sre/constants';
import { TConnectorService } from '@sre/types/SRE.types';
import { ILLMConnector } from './LLM.service/ILLMConnector';
import models from './models';
import { LLMConnector } from './LLM.service/connectors/LLMConnector.class';

export function getLLMConnector(model): LLMConnector {
    return ConnectorService.Instance.getInstance(TConnectorService.LLM, models[model]?.llm);
}

export async function componentLLMRequest(prompt, model, config: any = {}) {
    const LLM: LLMConnector = ConnectorService.Instance.getInstance(TConnectorService.LLM, models[model]?.llm);
    if (!LLM) return { error: 'LLM request failed', details: `Model ${model} not supported` };

    const params = await LLM.extractParams(config);
    const alias = models[model]?.alias || model;

    try {
        let response = await LLM.chatRequest(prompt, alias, params);
        response = LLM.postProcess(response);
        return response;
    } catch (error: any) {
        return { error: 'LLM request failed', details: error?.message || error?.toString() };
    }
}
