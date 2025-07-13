import EventEmitter from 'events';
import OpenAI from 'openai';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import {
    TLLMParams,
    ILLMRequestContext,
    TLLMMessageBlock,
    ToolData,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
} from '@sre/types/LLM.types';
import { OpenAIApiInterface, OpenAIApiContext, ToolConfig } from './OpenAIApiInterface';
import { HandlerDependencies } from '../types';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';

const MODELS_WITH_JSON_RESPONSE = ['gpt-4.5-preview', 'gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-4-turbo', 'gpt-3.5-turbo'];

/**
 * OpenAI Chat Completions API interface implementation
 * Handles all Chat Completions API-specific logic including:
 * - Stream creation and handling
 * - Request body preparation
 * - Tool and message transformations
 * - File attachment handling
 */
export class ChatCompletionsApiInterface extends OpenAIApiInterface {
    private deps: HandlerDependencies;

    constructor(context: OpenAIApiContext, deps: HandlerDependencies) {
        super(context);
        this.deps = deps;
    }

    async createRequest(body: any, context: ILLMRequestContext): Promise<any> {
        const openai = await this.deps.getClient(context);
        return await openai.chat.completions.create({
            ...body,
            stream: false,
        });
    }

    async createStream(body: any, context: ILLMRequestContext): Promise<any> {
        const openai = await this.deps.getClient(context);
        return await openai.chat.completions.create({
            ...body,
            stream: true,
            stream_options: { include_usage: true },
        });
    }

    handleStream(stream: any, context: ILLMRequestContext): EventEmitter {
        const emitter = new EventEmitter();
        const usage_data: any[] = [];
        const reportedUsage: any[] = [];
        let finishReason = 'stop';

        // Process stream asynchronously while returning emitter immediately
        (async () => {
            let finalToolsData: any[] = [];

            try {
                // Step 1: Process the stream
                const streamResult = await this.processStream(stream, emitter, usage_data);
                finalToolsData = streamResult.toolsData;
                finishReason = streamResult.finishReason;

                // Step 2: Report usage statistics
                this.reportUsageStatistics(usage_data, context, reportedUsage);

                // Step 3: Emit final events
                this.emitFinalEvents(emitter, finalToolsData, reportedUsage, finishReason);
            } catch (error) {
                emitter.emit('error', error);
            }
        })();

        return emitter;
    }

    /**
     * Process the chat completions API stream format
     */
    private async processStream(stream: any, emitter: EventEmitter, usage_data: any[]): Promise<{ toolsData: any[]; finishReason: string }> {
        let toolsData: any[] = [];
        let finishReason = 'stop';

        for await (const part of stream) {
            const delta = part.choices[0]?.delta;
            const usage = part.usage;

            // Collect usage statistics
            if (usage) {
                usage_data.push(usage);
            }

            // Emit data event for delta
            emitter.emit('data', delta);

            // Handle content deltas
            if (!delta?.tool_calls && delta?.content) {
                emitter.emit('content', delta?.content, delta?.role);
            }

            // Handle tool calls
            if (delta?.tool_calls) {
                const toolCall = delta?.tool_calls?.[0];
                const index = toolCall?.index;

                if (!toolsData[index]) {
                    toolsData[index] = { name: '', arguments: '', id: '' };
                }

                if (toolCall?.function?.name) {
                    toolsData[index].name = toolCall.function.name;
                }
                if (toolCall?.function?.arguments) {
                    toolsData[index].arguments += toolCall.function.arguments;
                }
                if (toolCall?.id) {
                    toolsData[index].id = toolCall.id;
                }
            }

            // Handle finish reason
            if (part.choices[0]?.finish_reason) {
                finishReason = part.choices[0].finish_reason;
            }
        }

        return { toolsData: this.extractToolCalls(toolsData), finishReason };
    }

    /**
     * Extract and format tool calls from the accumulated data
     */
    private extractToolCalls(toolsData: any[]): any[] {
        return toolsData.map((tool) => ({
            name: tool.name,
            arguments: tool.arguments,
            id: tool.id,
        }));
    }

    /**
     * Report usage statistics
     */
    private reportUsageStatistics(usage_data: any[], context: ILLMRequestContext, reportedUsage: any[]): void {
        // Report normal usage
        usage_data.forEach((usage) => {
            const reported = this.deps.reportUsage(usage, this.buildUsageContext(context));
            reportedUsage.push(reported);
        });

        // Report search tool usage if enabled
        if (context.toolsInfo?.webSearch?.enabled) {
            const searchUsage = this.calculateSearchToolUsage(context);
            const reported = this.deps.reportUsage(searchUsage, this.buildUsageContext(context));
            reportedUsage.push(reported);
        }
    }

    /**
     * Emit final events
     */
    private emitFinalEvents(emitter: EventEmitter, toolsData: any[], reportedUsage: any[], finishReason: string): void {
        // Emit tool info event if tools were called
        if (toolsData.length > 0) {
            emitter.emit('tool_info', toolsData);
        }

        // Emit interrupted event if finishReason is not 'stop'
        if (finishReason !== 'stop') {
            emitter.emit('interrupted', finishReason);
        }

        // Emit end event with delay to ensure proper event ordering
        setTimeout(() => {
            emitter.emit('end', toolsData, reportedUsage, finishReason);
        }, 100);
    }

    /**
     * Build usage context parameters from request context
     */
    private buildUsageContext(context: ILLMRequestContext) {
        return {
            modelEntryName: context.modelEntryName,
            keySource: context.isUserKey ? APIKeySource.User : APIKeySource.Smyth,
            agentId: context.agentId,
            teamId: context.teamId,
        };
    }

    /**
     * Calculate search tool usage with cost
     */
    private calculateSearchToolUsage(context: ILLMRequestContext) {
        const modelName = context.modelEntryName?.replace('@built-in/', '');
        const cost = this.getSearchToolCost(modelName, context.toolsInfo?.webSearch?.contextSize);

        return {
            cost,
            completion_tokens: 0,
            prompt_tokens: 0,
            total_tokens: 0,
        };
    }

    /**
     * Get search tool cost based on model and context size
     */
    private getSearchToolCost(modelName: string, contextSize: string): number {
        const costForNormalModels = {
            low: 30 / 1000,
            medium: 35 / 1000,
            high: 50 / 1000,
        };
        const costForMiniModels = {
            low: 25 / 1000,
            medium: 27.5 / 1000,
            high: 30 / 1000,
        };

        const searchToolCost = {
            'gpt-4.1': costForNormalModels,
            'gpt-4o': costForNormalModels,
            'gpt-4o-search': costForNormalModels,
            'gpt-4.1-mini': costForMiniModels,
            'gpt-4o-mini': costForMiniModels,
            'gpt-4o-mini-search': costForMiniModels,
        };

        return searchToolCost?.[modelName]?.[contextSize] || 0;
    }

    async prepareRequestBody(params: TLLMParams): Promise<OpenAI.ChatCompletionCreateParams> {
        const messages = await this.prepareMessages(params);

        // Handle JSON response format
        this.handleJsonResponseFormat(messages, params);

        const body: OpenAI.ChatCompletionCreateParams = {
            model: params.model as string,
            messages,
        };

        // Handle max tokens
        if (params?.maxTokens !== undefined) {
            body.max_completion_tokens = params.maxTokens;
        }

        // Handle tools configuration
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            body.tools = params?.toolsConfig?.tools as OpenAI.ChatCompletionTool[];
            body.tool_choice = params?.toolsConfig?.tool_choice;
        }

        // Handle temperature
        if (params?.temperature !== undefined) {
            body.temperature = params.temperature;
        }

        return body;
    }

    transformToolsConfig(config: ToolConfig): any[] {
        return config.toolDefinitions.map((tool) => ({
            type: tool.type || 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || {
                    type: 'object',
                    properties: tool.properties,
                    required: tool.requiredFields,
                },
            },
        }));
    }

    transformMessages(messages: any[]): any[] {
        // Chat Completions API uses messages as-is, no transformation needed
        return messages;
    }

    transformToolMessageBlocks(messageBlock: TLLMMessageBlock, toolsData: ToolData[]): TLLMToolResultMessageBlock[] {
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

    async handleFileAttachments(files: BinaryInput[], agentId: string, messages: any[]): Promise<any[]> {
        if (files.length === 0) return messages;

        const uploadedFiles = await this.uploadFiles(files, agentId);
        const validImageFiles = this.getValidImageFiles(uploadedFiles);
        const validDocumentFiles = this.getValidDocumentFiles(uploadedFiles);

        const imageData = validImageFiles.length > 0 ? await this.getImageDataForInterface(validImageFiles, agentId) : [];
        const documentData = validDocumentFiles.length > 0 ? await this.getDocumentDataForInterface(validDocumentFiles, agentId) : [];

        // For Chat Completions, we modify the last user message
        const userMessage = Array.isArray(messages) ? messages.pop() : {};
        const prompt = userMessage?.content || '';

        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData, ...documentData];

        messages.push({ role: 'user', content: promptData });

        return messages;
    }

    getInterfaceName(): string {
        return 'chat.completions';
    }

    validateParameters(params: TLLMParams): boolean {
        // Add any Chat Completions API specific validation
        return true;
    }

    /**
     * Prepare messages for Chat Completions API
     */
    private async prepareMessages(params: TLLMParams): Promise<any[]> {
        const messages = params?.messages || [];
        const files: BinaryInput[] = params?.files || [];

        // Handle files if present
        if (files.length > 0) {
            return await this.handleFileAttachments(files, params.agentId, [...messages]);
        }

        return messages;
    }

    /**
     * Handle JSON response format for Chat Completions API
     */
    private handleJsonResponseFormat(messages: any[], params: TLLMParams): void {
        const responseFormat = params?.responseFormat || '';
        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messages?.[0]?.role === TLLMMessageRole.System) {
                messages[0].content += JSON_RESPONSE_INSTRUCTION;
            } else {
                messages.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (MODELS_WITH_JSON_RESPONSE.includes(params.model as string)) {
                params.responseFormat = { type: 'json_object' };
            } else {
                params.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }
    }
}
