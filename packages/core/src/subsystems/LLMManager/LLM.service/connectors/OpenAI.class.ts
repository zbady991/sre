import { encodeChat } from 'gpt-tokenizer';
import OpenAI from 'openai';
import { ILLMConnector } from '../ILLMConnector';
import { LLMConnector } from './LLMConnector.class';
import Agent from '@sre/AgentManager/Agent.class';
import { LLMParams } from '@sre/types/LLM.types';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export class OpenAIConnector extends LLMConnector implements ILLMConnector {
    public name = 'LLM:OpenAI';
    async chatRequest(prompt, params, agent?: Agent) {
        // if (!model) model = 'gpt-3.5-turbo';

        if (!params.model) params.model = 'gpt-4-turbo';

        // Open to take system message with params, if no system message found then force to get JSON response in default
        if (!params.messages) params.messages = [];
        if (params.messages[0]?.role !== 'system') {
            params.messages.unshift({
                role: 'system',
                content: 'All responses should be in valid json format. The returned json should not be formatted with any newlines or indentations.',
            });

            if (params.model.startsWith('gpt-4-turbo') || params.model.startsWith('gpt-3.5-turbo')) {
                params.response_format = { type: 'json_object' };
            }
        }

        if (params.messages.length === 1) {
            params.messages.push({ role: 'user', content: prompt });
        }
        delete params.prompt;

        // Check if the team has their own API key, then use it
        const apiKey = params?.apiKey;
        delete params.apiKey; // Remove apiKey from params

        const openai = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY,
        });

        // Check token limit
        const promptTokens = encodeChat(params.messages, 'gpt-4')?.length;

        const tokensLimit = this.checkTokensLimit({
            model: params.model,
            promptTokens,
            completionTokens: params?.max_tokens,
            hasTeamAPIKey: !!apiKey,
        });

        if (tokensLimit.isExceeded) throw new Error(tokensLimit.error);

        const response: any = await openai.chat.completions.create(params);

        const data =
            response?.choices?.[0]?.text ||
            response?.choices?.[0]?.message.content ||
            response?.data?.choices?.[0]?.text || //Legacy openai format
            response?.data?.choices?.[0]?.message.content; //Legacy openai format

        return data;
    }
    async visionRequest(prompt, params, agent?: Agent) {
        if (!params.model) params.model = 'gpt-4-vision-preview';

        // Open to take system message with params, if no system message found then force to get JSON response in default
        if (!params.messages || params.messages?.length === 0) params.messages = [];
        if (params.messages?.role !== 'system') {
            params.messages.unshift({
                role: 'system',
                content:
                    'All responses should be in valid json format. The returned json should not be formatted with any newlines, indentations. For example: {"<guess key from response>":"<response>"}',
            });
        }

        const sources: BinaryInput[] = params?.sources || [];
        delete params?.sources; // Remove images from params

        //const imageData = await prepareImageData(sources, 'OpenAI', agent);

        const imageData = [];
        for (let source of sources) {
            const bufferData = await source.readData(AccessCandidate.agent(agent.id));
            const base64Data = bufferData.toString('base64');
            const url = `data:${source.mimetype};base64,${base64Data}`;
            imageData.push({
                type: 'image_url',
                image_url: {
                    url,
                },
            });
        }

        // Add user message
        const content = [{ type: 'text', text: prompt }, ...imageData];
        params.messages.push({ role: 'user', content });

        try {
            // Check if the team has their own API key, then use it
            const apiKey = params?.apiKey;
            delete params.apiKey; // Remove apiKey from params

            const openai = new OpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
            });

            // Check token limit
            const promptTokens = await this.countVisionPromptTokens(content);

            const tokenLimit = this.checkTokensLimit({
                model: params.model,
                promptTokens,
                completionTokens: params?.max_tokens,
                hasTeamAPIKey: !!apiKey,
            });

            if (tokenLimit.isExceeded) throw new Error(tokenLimit.error);

            const response: any = await openai.chat.completions.create({ ...params });

            const data = response?.choices?.[0]?.text || response?.choices?.[0]?.message.content;

            return data;
        } catch (error) {
            console.log('Error in visionLLMRequest: ', error);

            throw error;
        }
    }
    async toolRequest(prompt, params, agent?: Agent) {
        return 'OpenAI :' + prompt;
    }

    public async extractVisionLLMParams(config: any) {
        const params: LLMParams = await super.extractVisionLLMParams(config);

        return params;
    }
}
