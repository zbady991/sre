//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { EchoConnector } from './connectors/Echo.class';
import { OpenAIConnector } from './connectors/OpenAI.class';
import { ILLMConnector } from './ILLMConnector';
import models from '@sre/LLMManager/models';

export class LLMService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.Instance.register(TConnectorService.LLM, 'Echo', EchoConnector);
        ConnectorService.Instance.register(TConnectorService.LLM, 'OpenAI', OpenAIConnector);
    }

    public init() {
        ConnectorService.Instance.init(TConnectorService.LLM, 'Echo');
        ConnectorService.Instance.init(TConnectorService.LLM, 'OpenAI');
    }

    chatRequest(prompt, model, params: any = {}) {
        return new Promise((resolve, reject) => {
            const LLM: ILLMConnector = ConnectorService.Instance.getInstance(TConnectorService.LLM, models[model]?.llm);
            if (!LLM) return reject({ error: 'LLM request failed', details: `Model ${model} not supported` });

            const alias = models[model]?.alias || model;

            try {
                LLM.chatRequest(prompt, alias, params)
                    .then((response) => {
                        resolve(response);
                    })
                    .catch((error) => {
                        reject({ error: 'LLM request failed', details: error?.message || error?.toString() });
                    });
            } catch (error: any) {
                reject({ error: 'LLM request failed', details: error?.message || error?.toString() });
            }
        });
    }
}
