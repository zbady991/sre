import { Connector } from '@sre/Core/Connector.class';
import { createLogger } from '@sre/Core/Logger';
import { ILLMConnector } from '@sre/LLMManager/LLM.service/ILLMConnector'; //'../ILLMConnector';
import models from '@sre/LLMManager/models';
import paramMappings from '@sre/LLMManager/paramMappings';
import { DEFAULT_MAX_TOKENS_FOR_LLM } from '@sre/constants';
import { LLMParams } from '@sre/types/LLM.types';
import { parseRepairJson } from '@sre/utils';
const console = createLogger('LLMConnector');

export abstract class LLMConnector extends Connector implements ILLMConnector {
    public abstract name: string;
    abstract chatRequest(prompt, params: any): Promise<any>;
    abstract visionRequest(prompt, params: any): Promise<any>;
    abstract toolRequest(prompt, params: any): Promise<any>;

    private getAllowedCompletionTokens(model: string, hasTeamAPIKey: boolean = false) {
        const alias = models[model]?.alias || model;

        // Only allow full token limit if the API key is provided by the team
        const maxTokens = hasTeamAPIKey
            ? models[alias]?.keyOptions?.completionTokens || models[alias]?.keyOptions?.tokens
            : models[alias]?.completionTokens || models[alias]?.tokens;

        return +(maxTokens ?? DEFAULT_MAX_TOKENS_FOR_LLM);
    }

    private async getSafeMaxTokens(givenMaxTokens: number, model: string, hasApiKey: boolean): Promise<number> {
        let allowedTokens = this.getAllowedCompletionTokens(model, hasApiKey);

        // If the specified max tokens exceed the allowed limit, use the maximum allowed tokens instead.
        let maxTokens = givenMaxTokens > allowedTokens ? allowedTokens : givenMaxTokens;

        return +maxTokens;
    }

    public resolveModelName(model: string) {
        return models[model]?.alias || model;
    }
    private getAllowedContextTokens(model: string, hasTeamAPIKey: boolean = false) {
        const alias = this.resolveModelName(model);

        // Only allow full token limit if the API key is provided by the team
        const maxTokens = hasTeamAPIKey ? models[alias]?.keyOptions?.tokens : models[alias]?.tokens;

        return +(maxTokens ?? DEFAULT_MAX_TOKENS_FOR_LLM);
    }

    public checkTokensLimit({
        model,
        promptTokens,
        completionTokens,
        hasTeamAPIKey = false,
    }: {
        model: string;
        promptTokens: number;
        completionTokens: number;
        hasTeamAPIKey?: boolean;
    }): { isExceeded: boolean; error: string } {
        const allowedContextTokens = this.getAllowedContextTokens(model, hasTeamAPIKey);
        const totalTokens = promptTokens + completionTokens;

        if (totalTokens > allowedContextTokens) {
            return {
                isExceeded: true,
                error: hasTeamAPIKey
                    ? `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`
                    : `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`,
            };
        }

        return { isExceeded: false, error: '' };
    }

    public enhancePrompt(prompt: string, config: any) {
        let newPrompt = prompt;
        const outputs = {};
        for (let con of config.outputs) {
            if (con.default) continue;
            outputs[con.name] = con?.description ? `<${con?.description}>` : '';
        }

        const excludedKeys = ['_debug', '_error'];
        const outputKeys = Object.keys(outputs).filter((key) => !excludedKeys.includes(key));

        if (outputKeys.length > 0) {
            const outputFormat = {};
            outputKeys.forEach((key) => (outputFormat[key] = '<value>'));

            newPrompt +=
                '\n##\nExpected output format = ' +
                JSON.stringify(outputFormat) +
                '\nThe output JSON should only use the entries from the output format.';

            //console.debug(` Enhanced prompt \n`, prompt, '\n');
        }

        return newPrompt;
    }
    public async extractParams(config: any) {
        const params: LLMParams = {};
        const model: string = config.data.model;
        // Retrieve the API key and include it in the parameters here, as it is required for the max tokens check.

        const apiKey = '';
        //TODO: implement apiKey extraction from team vault
        //const apiKey = await getLLMApiKey(model, agent?.teamId);
        //if (apiKey) params.apiKey = apiKey;

        /*** Prepare parameters from config data ***/

        // * We need to keep the config.data unchanged to avoid any side effects, especially when run components with loop
        const clonedConfigData = JSON.parse(JSON.stringify(config.data || {}));
        const configParams = {};

        for (const [key, value] of Object.entries(clonedConfigData)) {
            let _value: string | number | string[] | null = value as string;

            // When we have stopSequences, we need to split it into an array
            if (key === 'stopSequences') {
                _value = _value ? _value?.split(',') : null;
            }

            // When we have a string that is a number, we need to convert it to a number
            if (typeof _value === 'string' && !isNaN(Number(_value))) {
                _value = +_value;
            }

            // Always provide safe max tokens based on the model and apiKey
            if (key === 'maxTokens') {
                let maxTokens = Number(_value);

                if (!maxTokens) {
                    throw new Error('Max output token not provided');
                }

                maxTokens = await this.getSafeMaxTokens(maxTokens, model, !!apiKey);
                _value = maxTokens;
            }

            configParams[key] = _value;
        }

        /*** Prepare LLM specific parameters ***/

        const alias = models[model]?.alias || model;
        const llm = models[alias]?.llm;

        for (const [configKey, paramKey] of Object.entries(paramMappings[llm])) {
            // we need to allow 0 as truthy
            if (configParams?.[configKey] !== undefined || configParams?.[configKey] !== null || configParams?.[configKey] !== '') {
                const value = configParams[configKey];

                params[paramKey as string] = value;
            }
        }

        return params;
    }

    public postProcess(response: any) {
        try {
            return parseRepairJson(response);
        } catch (error) {
            return {
                error: 'Invalid JSON response',
                data: response,
                details: 'The response from the model is not a valid JSON object. Please check the model output and try again.',
            };
        }
    }
}
