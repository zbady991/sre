//==[ SRE: LLM ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { EchoConnector } from './connectors/Echo.class';
import { OpenAIConnector } from './connectors/OpenAI.class';
import { ILLMConnector } from './ILLMConnector';
import models from '@sre/LLMManager/models';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import Agent from '@sre/AgentManager/Agent.class';

export class LLMService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.LLM, 'Echo', EchoConnector);
        ConnectorService.register(TConnectorService.LLM, 'OpenAI', OpenAIConnector);
    }

    public init() {
        //auto initialize builting models
        ConnectorService.init(TConnectorService.LLM, 'Echo');
        ConnectorService.init(TConnectorService.LLM, 'OpenAI');
    }

    // chatRequest(prompt, model, params: any = {}) {
    //     return new Promise((resolve, reject) => {
    //         const LLM: ILLMConnector = ConnectorService.getInstance(TConnectorService.LLM, models[model]?.llm);
    //         if (!LLM) return reject({ error: 'LLM request failed', details: `Model ${model} not supported` });

    //         //const alias = models[model]?.alias || model;

    //         try {
    //             LLM.chatRequest(prompt, params)
    //                 .then((response) => {
    //                     resolve(response);
    //                 })
    //                 .catch((error) => {
    //                     reject({ error: 'LLM request failed', details: error?.message || error?.toString() });
    //                 });
    //         } catch (error: any) {
    //             reject({ error: 'LLM request failed', details: error?.message || error?.toString() });
    //         }
    //     });
    // }
}
