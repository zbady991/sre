import EventEmitter from 'events';
import axios, { AxiosInstance } from 'axios';

import { JSON_RESPONSE_INSTRUCTION, BUILT_IN_MODEL_PREFIX } from '@sre/constants';

import {
    TLLMParams,
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    BasicCredentials,
    ILLMRequestFuncParams,
    TLLMChatResponse,
    ILLMRequestContext,
} from '@sre/types/LLM.types';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';

import { LLMConnector } from '../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';

type ChatCompletionParams = {
    model: string;
    messages: any[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    response_format?: { type: string };
    stream?: boolean;
    tools?: any[];
    tool_choice?: any;
};

type TUsage = {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens?: number };
    reasoning_tokens?: number;
};

export class GrokConnector extends LLMConnector {
    public name = 'LLM:Grok';

    private async getClient(params: ILLMRequestContext): Promise<AxiosInstance> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;
        const baseURL = params?.modelInfo?.baseURL || 'https://api.x.ai/v1';

        if (!apiKey) throw new Error('Please provide an API key for Grok');

        return axios.create({
            baseURL,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        try {
            const grok = await this.getClient(context);
            const response = await grok.post('/chat/completions', body);

            const message = response?.data?.choices?.[0]?.message;
            const finishReason = response?.data?.choices?.[0]?.finish_reason;
            const usage = response?.data?.usage as TUsage;

            let toolsData: ToolData[] = [];
            let useTool = false;

            if (finishReason === 'tool_calls') {
                toolsData =
                    message?.tool_calls?.map((tool, index) => ({
                        index,
                        id: tool?.id,
                        type: tool?.type,
                        name: tool?.function?.name,
                        arguments: tool?.function?.arguments,
                        role: 'tool',
                    })) || [];

                useTool = true;
            }

            this.reportUsage(usage, {
                modelEntryName: context.modelEntryName,
                keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                agentId: context.agentId,
                teamId: context.teamId,
            });

            return {
                content: message?.content ?? '',
                finishReason,
                useTool,
                toolsData,
                message,
                usage,
            };
        } catch (error) {
            throw error;
        }
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();

        try {
            const grok = await this.getClient(context);
            const response = await grok.post(
                '/chat/completions',
                { ...body, stream: true },
                {
                    responseType: 'stream',
                }
            );

            const usage_data: any[] = [];
            const reportedUsage: any[] = [];
            let finishReason = 'stop';
            let toolsData: any[] = [];

            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            // Handle stream completion
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            const usage = parsed.usage;

                            if (usage) {
                                usage_data.push(usage);
                            }

                            if (delta) {
                                emitter.emit('data', delta);

                                if (delta.content) {
                                    emitter.emit('content', delta.content, delta.role);
                                }

                                if (delta.tool_calls) {
                                    const toolCall = delta.tool_calls[0];
                                    const index = toolCall?.index;

                                    toolsData[index] = {
                                        index,
                                        role: 'tool',
                                        id: (toolsData?.[index]?.id || '') + (toolCall?.id || ''),
                                        type: (toolsData?.[index]?.type || '') + (toolCall?.type || ''),
                                        name: (toolsData?.[index]?.name || '') + (toolCall?.function?.name || ''),
                                        arguments: (toolsData?.[index]?.arguments || '') + (toolCall?.function?.arguments || ''),
                                    };
                                }
                            }

                            if (parsed.choices?.[0]?.finish_reason) {
                                finishReason = parsed.choices[0].finish_reason;
                            }
                        } catch (e) {
                            // Ignore parsing errors for incomplete chunks
                        }
                    }
                }
            });

            response.data.on('end', () => {
                if (toolsData.length > 0) {
                    emitter.emit('toolInfo', toolsData);
                }

                usage_data.forEach((usage) => {
                    const _reported = this.reportUsage(usage, {
                        modelEntryName: context.modelEntryName,
                        keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
                        agentId: context.agentId,
                        teamId: context.teamId,
                    });
                    reportedUsage.push(_reported);
                });

                if (finishReason !== 'stop') {
                    emitter.emit('interrupted', finishReason);
                }

                setTimeout(() => {
                    emitter.emit('end', toolsData, reportedUsage, finishReason);
                }, 100);
            });

            response.data.on('error', (error) => {
                emitter.emit('error', error);
            });
        } catch (error) {
            emitter.emit('error', error);
        }

        return emitter;
    }

    protected async webSearchRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        const emitter = new EventEmitter();

        try {
            // For Grok, live search is built into the model - no need for explicit tools
            // The model has access to real-time information from X/Twitter and web search
            const searchBody = {
                ...body,
                // Enable live search by using a search-enabled model
                // and possibly adding search-specific system message
                messages: [
                    {
                        role: 'system',
                        content: 'You have access to real-time information via live search. Use current information when answering questions.',
                    },
                    ...(body.messages || []),
                ],
            };

            // Use the stream request for web search to handle real-time results
            return this.streamRequest({ acRequest, body: searchBody, context });
        } catch (error) {
            emitter.emit('error', error);
            return emitter;
        }
    }

    protected async reqBodyAdapter(params: TLLMParams): Promise<ChatCompletionParams> {
        const messages = params?.messages || [];
        const modelName = params.model as string;

        // Handle JSON response format
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            params.responseFormat = { type: 'json_object' };
        }

        const body: ChatCompletionParams = {
            model: modelName,
            messages,
        };

        // Add parameters if they're not undefined and not 0 (for reasoning models)
        if (params?.maxTokens !== undefined) body.max_tokens = params.maxTokens;
        if (params?.temperature !== undefined) body.temperature = params.temperature;
        if (params?.topP !== undefined) body.top_p = params.topP;

        if (params?.responseFormat) {
            body.response_format = params.responseFormat;
        }

        // Add tools configuration if available
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            body.tools = params.toolsConfig.tools;
        }

        if (params?.toolsConfig?.tool_choice) {
            body.tool_choice = params.toolsConfig.tool_choice;
        }

        return body;
    }

    protected reportUsage(usage: TUsage, metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: usage?.prompt_tokens - (usage?.prompt_tokens_details?.cached_tokens || 0),
            output_tokens: usage?.completion_tokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: usage?.prompt_tokens_details?.cached_tokens || 0,
            reasoning_tokens: usage?.reasoning_tokens || 0,
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto' }) {
        let tools: any[] = [];

        if (type === 'function') {
            tools = toolDefinitions.map((tool) => {
                const { name, description, properties, requiredFields } = tool;

                return {
                    type: 'function',
                    function: {
                        name,
                        description,
                        parameters: {
                            type: 'object',
                            properties,
                            required: requiredFields,
                        },
                    },
                };
            });
        }

        return tools?.length > 0 ? { tools, tool_choice: toolChoice || 'auto' } : {};
    }

    public transformToolMessageBlocks({
        messageBlock,
        toolsData,
    }: {
        messageBlock: TLLMMessageBlock;
        toolsData: ToolData[];
    }): TLLMToolResultMessageBlock[] {
        const messageBlocks: TLLMToolResultMessageBlock[] = [];

        if (messageBlock) {
            const transformedMessageBlock = {
                ...messageBlock,
                content: typeof messageBlock.content === 'object' ? JSON.stringify(messageBlock.content) : messageBlock.content,
            };
            if (transformedMessageBlock.tool_calls) {
                for (let toolCall of transformedMessageBlock.tool_calls) {
                    toolCall.function.arguments =
                        typeof toolCall.function.arguments === 'object' ? JSON.stringify(toolCall.function.arguments) : toolCall.function.arguments;
                }
            }
            messageBlocks.push(transformedMessageBlock);
        }

        const transformedToolsData = toolsData.map((toolData) => ({
            tool_call_id: toolData.id,
            role: TLLMMessageRole.Tool,
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result),
        }));

        return [...messageBlocks, ...transformedToolsData];
    }

    public getConsistentMessages(messages) {
        const _messages = LLMHelper.removeDuplicateUserMessages(messages);

        return _messages.map((message) => {
            const _message = { ...message };
            let textContent = '';

            if (message?.parts) {
                textContent = message.parts.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (Array.isArray(message?.content)) {
                textContent = message.content.map((textBlock) => textBlock?.text || '').join(' ');
            } else if (message?.content) {
                textContent = message.content;
            }

            _message.content = textContent;

            return _message;
        });
    }
}
