import { parseRepairJson } from '@sre/utils';
import { ILLMConnector } from '../ILLMConnector';
import { LLMConnector } from './LLMConnector.class';

export class EchoConnector extends LLMConnector implements ILLMConnector {
    public name = 'LLM:Echo';
    async chatRequest(prompt, model, params) {
        return prompt;
    }
    async visionRequest(prompt, model, params) {
        return prompt;
    }
    async toolRequest(prompt, model, params) {
        return prompt;
    }

    public enhancePrompt(prompt: string, config: any) {
        //Echo model does not require enhancements, because we are just echoing the prompt as is.
        return prompt;
    }

    public postProcess(response: any) {
        try {
            return parseRepairJson(response);
        } catch (error) {
            return response;
        }
    }
}
