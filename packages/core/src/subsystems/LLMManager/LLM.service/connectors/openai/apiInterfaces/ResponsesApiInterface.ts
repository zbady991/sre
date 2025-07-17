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
    TLLMPreparedParams,
} from '@sre/types/LLM.types';
import { OpenAIApiInterface, OpenAIApiContext, ToolConfig } from './OpenAIApiInterface';
import { HandlerDependencies, TToolType } from '../types';
import { getSearchToolCost } from '../config/costs';

type TSearchContextSize = 'low' | 'medium' | 'high';
type TSearchLocation = {
    type: 'approximate';
    city?: string;
    country?: string;
    region?: string;
    timezone?: string;
};

/**
 * OpenAI Responses API interface implementation
 * Handles all Responses API-specific logic including:
 * - Stream creation and handling
 * - Request body preparation
 * - Tool and message transformations
 * - File attachment handling
 */
export class ResponsesApiInterface extends OpenAIApiInterface {
    private deps: HandlerDependencies;

    constructor(context: OpenAIApiContext, deps: HandlerDependencies) {
        super(context);
        this.deps = deps;
    }

    async createRequest(body: OpenAI.Responses.ResponseCreateParams, context: ILLMRequestContext): Promise<OpenAI.Responses.Response> {
        const openai = await this.deps.getClient(context);
        return await openai.responses.create({
            ...body,
            stream: false,
        });
    }

    async createStream(body: OpenAI.Responses.ResponseCreateParams, context: ILLMRequestContext): Promise<AsyncIterable<any>> {
        const openai = await this.deps.getClient(context);
        return await openai.responses.create({
            ...body,
            stream: true,
        });
    }

    handleStream(stream: AsyncIterable<any>, context: ILLMRequestContext): EventEmitter {
        const emitter = new EventEmitter();
        const usage_data: any[] = [];
        const reportedUsage: any[] = [];
        let finishReason = 'stop';

        // Process stream asynchronously while returning emitter immediately
        (async () => {
            let finalToolsData: ToolData[] = [];

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
     * Process the responses API stream format
     */
    private async processStream(
        stream: AsyncIterable<any>,
        emitter: EventEmitter,
        usage_data: any[]
    ): Promise<{ toolsData: ToolData[]; finishReason: string }> {
        let toolsData: ToolData[] = [];
        let finishReason = 'stop';

        for await (const part of stream) {
            const delta = part.choices?.[0]?.delta;
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
                    toolsData[index] = {
                        index: index || 0,
                        id: '',
                        type: 'function',
                        name: '',
                        arguments: '',
                        role: 'assistant',
                    };
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
            if (part.choices?.[0]?.finish_reason) {
                finishReason = part.choices[0].finish_reason;
            }
        }

        return { toolsData: this.extractToolCalls(toolsData), finishReason };
    }

    /**
     * Extract and format tool calls from the accumulated data
     */
    private extractToolCalls(output: ToolData[]): ToolData[] {
        return output.map((tool) => ({
            index: tool.index,
            name: tool.name,
            arguments: tool.arguments,
            id: tool.id,
            type: tool.type,
            role: tool.role,
        }));
    }

    /**
     * Report usage statistics
     */
    private reportUsageStatistics(usage_data: any[], context: ILLMRequestContext, reportedUsage: any[]): void {
        // Report normal usage
        usage_data.forEach((usage) => {
            // Convert ResponseUsage to CompletionUsage format for compatibility
            const convertedUsage = {
                completion_tokens: usage.completion_tokens || 0,
                prompt_tokens: usage.prompt_tokens || 0,
                total_tokens: usage.total_tokens || 0,
                ...usage,
            };
            const reported = this.deps.reportUsage(convertedUsage, this.buildUsageContext(context));
            reportedUsage.push(reported);
        });

        // Report search tool usage if enabled
        if (context.toolsInfo?.openai?.webSearch?.enabled) {
            const searchUsage = this.calculateSearchToolUsage(context);
            const reported = this.deps.reportUsage(searchUsage, this.buildUsageContext(context));
            reportedUsage.push(reported);
        }
    }

    /**
     * Emit final events
     */
    private emitFinalEvents(emitter: EventEmitter, toolsData: ToolData[], reportedUsage: any[], finishReason: string): void {
        // Emit tool info event if tools were called
        if (toolsData.length > 0) {
            emitter.emit('tool_info', toolsData);
        }

        // Emit interrupted event if finishReason is not 'stop'
        if (finishReason !== 'stop') {
            emitter.emit('interrupted', finishReason);
        }

        // Emit end event with setImmediate to ensure proper event ordering
        setImmediate(() => {
            emitter.emit('end', toolsData, reportedUsage, finishReason);
        });
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
        const cost = getSearchToolCost(modelName, context.toolsInfo?.openai?.webSearch?.contextSize);

        return {
            cost,
            completion_tokens: 0,
            prompt_tokens: 0,
            total_tokens: 0,
        };
    }

    async prepareRequestBody(params: TLLMPreparedParams): Promise<OpenAI.Responses.ResponseCreateParams> {
        const input = await this.prepareInputMessages(params);

        const body: OpenAI.Responses.ResponseCreateParams = {
            model: params.model as string,
            input,
        };

        // Note: max_tokens is handled differently in the Responses API
        // It may not be available in the current version

        // Handle max tokens
        if (params?.maxTokens !== undefined) {
            body.max_output_tokens = params.maxTokens;
        }

        if (params?.temperature !== undefined) {
            body.temperature = params.temperature;
        }

        if (params?.topP !== undefined) {
            body.top_p = params.topP;
        }

        let tools: OpenAI.Responses.Tool[] = [];

        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            tools = await this.prepareFunctionTools(params);
        }

        // Add null safety check before accessing toolsInfo
        if (params.toolsInfo?.openai?.webSearch?.enabled) {
            const searchTool = this.prepareWebSearchTool(params);
            tools.push(searchTool);
        }

        if (tools.length > 0) {
            body.tools = tools;

            if (params?.toolsConfig?.tool_choice) {
                body.tool_choice = params?.toolsConfig?.tool_choice as any;
            }
        }

        return body;
    }

    transformToolsConfig(config: ToolConfig): OpenAI.Responses.Tool[] {
        return config.toolDefinitions.map((tool) => ({
            type: tool.type || 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters || {
                type: 'object',
                properties: tool.properties,
                required: tool.requiredFields,
            },
        }));
    }

    transformMessages(messages: OpenAI.ChatCompletionMessageParam[]): any[] {
        const transformedMessages: any[] = [];

        messages.forEach((message) => {
            if (message.role === 'assistant' && message.tool_calls) {
                // Split assistant message with tool_calls into separate items
                if (message.content) {
                    transformedMessages.push({
                        role: 'assistant',
                        content: message.content,
                    });
                }

                message.tool_calls.forEach((toolCall) => {
                    transformedMessages.push({
                        type: 'function_call',
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments,
                        call_id: toolCall.id,
                    });
                });
            } else if (message.role === 'tool') {
                // Transform tool message to function_call_output
                transformedMessages.push({
                    type: 'function_call_output',
                    call_id: message.tool_call_id,
                    output: message.content,
                });
            } else {
                // Transform regular messages
                transformedMessages.push(this.transformRegularMessage(message));
            }
        });

        return transformedMessages;
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

        // Find the last user message and add files to it
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                // Ensure content is an array before pushing files
                if (typeof messages[i].content === 'string') {
                    messages[i].content = [{ type: 'input_text', text: messages[i].content }];
                } else if (!Array.isArray(messages[i].content)) {
                    messages[i].content = [];
                }
                messages[i].content.push(...imageData, ...documentData);
                break;
            }
        }

        // If no user message found, create one with files
        if (!messages.some((item) => item.role === 'user')) {
            messages.push({
                role: 'user',
                content: [...imageData, ...documentData],
            });
        }

        return messages;
    }

    getInterfaceName(): string {
        return 'responses';
    }

    validateParameters(params: TLLMParams): boolean {
        // Add any Responses API specific validation
        // Currently no specific validation is required for this API
        return true;
    }

    /**
     * Prepare input messages for Responses API
     */
    private async prepareInputMessages(params: TLLMParams): Promise<any[]> {
        const messages = params?.messages || [];
        const files: BinaryInput[] = params?.files || [];

        // Transform messages from Chat Completions format to Responses API format
        let input = this.transformMessages(messages);

        // Handle files if present
        if (files.length > 0) {
            input = await this.handleFileAttachments(files, params.agentId, input);
        }

        return input;
    }

    /**
     * Prepare tools for request
     */
    private async prepareFunctionTools(params: TLLMParams): Promise<OpenAI.Responses.Tool[]> {
        const tools: OpenAI.Responses.Tool[] = [];

        // Add regular function tools
        if (params?.toolsConfig?.tools && params?.toolsConfig?.tools?.length > 0) {
            const toolsConfig = this.transformToolsConfig({
                type: 'function',
                toolDefinitions: params.toolsConfig.tools.map((tool) => ({
                    name: tool.function?.name || tool.name,
                    description: tool.function?.description || tool.description,
                    properties: tool.function?.parameters?.properties || tool.parameters?.properties,
                    requiredFields: tool.function?.parameters?.required || tool.parameters?.required,
                })),
                toolChoice: 'auto',
                modelInfo: params.modelInfo,
            });
            tools.push(...toolsConfig);
        }

        return tools;
    }

    /**
     * Get web search tool configuration for OpenAI Responses API
     */
    private prepareWebSearchTool(params: TLLMPreparedParams): OpenAI.Responses.WebSearchTool {
        const webSearch = params?.toolsInfo?.openai?.webSearch;
        const contextSize = webSearch?.contextSize;
        const searchCity = webSearch?.city;
        const searchCountry = webSearch?.country;
        const searchRegion = webSearch?.region;
        const searchTimezone = webSearch?.timezone;

        const location: TSearchLocation = {
            type: 'approximate', // Required, always be 'approximate' when we implement location
        };

        if (searchCity) location.city = searchCity;
        if (searchCountry) location.country = searchCountry;
        if (searchRegion) location.region = searchRegion;
        if (searchTimezone) location.timezone = searchTimezone;

        const searchTool: OpenAI.Responses.WebSearchTool = {
            type: TToolType.WebSearch,
            search_context_size: (contextSize || 'medium') as TSearchContextSize,
        };

        // Add location only if any location field is provided. Since 'type' is always present, we check if the number of keys in the location object is greater than 1.
        if (Object.keys(location).length > 1) {
            searchTool.user_location = location;
        }

        return searchTool;
    }

    /**
     * Transform a regular message for Responses API format
     */
    private transformRegularMessage(message: OpenAI.ChatCompletionMessageParam): any {
        const transformedMessage: any = {
            role: message.role,
        };

        if (typeof message.content === 'string') {
            // For plain text messages, use content directly without type wrapper
            transformedMessage.content = message.content;
        } else if (Array.isArray(message.content)) {
            // Handle multimodal content - check if it has any file attachments
            const hasFileAttachments = message.content.some(
                (item) => item.type && item.type !== 'text' && item.type !== 'input_text' && item.type !== 'output_text'
            );

            if (hasFileAttachments) {
                // Keep structured array format for multimodal content with files
                transformedMessage.content = message.content;
            } else {
                // If it's just text items, extract as plain text
                const textItems = message.content.filter((item) => item.type === 'text' || item.type === 'input_text' || item.type === 'output_text');
                if (textItems.length === 1) {
                    transformedMessage.content = (textItems[0] as any).text || '';
                } else {
                    // Multiple text items - concatenate them
                    transformedMessage.content = textItems.map((item) => (item as any).text || '').join(' ');
                }
            }
        } else if (message.content) {
            // Fallback for other content types
            transformedMessage.content = String(message.content);
        }

        return transformedMessage;
    }
}
