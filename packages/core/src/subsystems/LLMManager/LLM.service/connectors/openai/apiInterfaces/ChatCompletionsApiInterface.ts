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
import { OpenAIApiInterface, ToolConfig } from './OpenAIApiInterface';
import { HandlerDependencies } from '../types';
import { JSON_RESPONSE_INSTRUCTION } from '@sre/constants';
import { getSearchToolCost } from '../config/costs';
import { supportsJsonResponse } from '../config/models';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';

// File size limits in bytes
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

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
    private validImageMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.image;
    private validDocumentMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.document;

    constructor(context: ILLMRequestContext, deps: HandlerDependencies) {
        super(context);
        this.deps = deps;
    }

    public async createRequest(body: OpenAI.ChatCompletionCreateParams, context: ILLMRequestContext): Promise<OpenAI.ChatCompletion> {
        const openai = await this.deps.getClient(context);
        return await openai.chat.completions.create({
            ...body,
            stream: false,
        });
    }

    public async createStream(
        body: OpenAI.ChatCompletionCreateParams,
        context: ILLMRequestContext
    ): Promise<AsyncIterable<OpenAI.ChatCompletionChunk>> {
        const openai = await this.deps.getClient(context);
        return await openai.chat.completions.create({
            ...body,
            stream: true,
            stream_options: { include_usage: true },
        });
    }

    public handleStream(stream: AsyncIterable<OpenAI.ChatCompletionChunk>, context: ILLMRequestContext): EventEmitter {
        const emitter = new EventEmitter();
        const usage_data: OpenAI.Completions.CompletionUsage[] = [];
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

    public async prepareRequestBody(params: TLLMParams): Promise<OpenAI.ChatCompletionCreateParams> {
        const messages = await this.prepareMessages(params);

        // Handle JSON response format
        const { messages: preparedMessages } = this.handleJsonResponseFormat(messages, params);

        const body: OpenAI.ChatCompletionCreateParams = {
            model: params.model as string,
            messages: preparedMessages,
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

    public transformToolsConfig(config: ToolConfig): OpenAI.ChatCompletionTool[] {
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

    public async handleFileAttachments(
        files: BinaryInput[],
        agentId: string,
        messages: OpenAI.ChatCompletionMessageParam[]
    ): Promise<OpenAI.ChatCompletionMessageParam[]> {
        if (files.length === 0) return messages;

        const uploadedFiles = await this.uploadFiles(files, agentId);
        const validImageFiles = this.getValidImageFiles(uploadedFiles);
        const validDocumentFiles = this.getValidDocumentFiles(uploadedFiles);

        // Process images and documents with Chat Completions specific formatting
        const imageData = await this.processImageData(validImageFiles, agentId);
        const documentData = await this.processDocumentData(validDocumentFiles, agentId);

        // For Chat Completions, we modify the last user message
        const userMessage = Array.isArray(messages) ? messages.pop() : { role: 'user', content: '' };
        const prompt = userMessage?.content || '';

        const promptData = [{ type: 'text', text: prompt || '' }, ...imageData, ...documentData];

        messages.push({ role: 'user', content: promptData });

        return messages;
    }

    /**
     * Process the chat completions API stream format
     */
    private async processStream(
        stream: AsyncIterable<OpenAI.ChatCompletionChunk>,
        emitter: EventEmitter,
        usage_data: OpenAI.Completions.CompletionUsage[]
    ): Promise<{ toolsData: ToolData[]; finishReason: string }> {
        let toolsData: ToolData[] = [];
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
            if (part.choices[0]?.finish_reason) {
                finishReason = part.choices[0].finish_reason;
            }
        }

        return { toolsData: this.extractToolCalls(toolsData), finishReason };
    }

    /**
     * Extract and format tool calls from the accumulated data
     */
    private extractToolCalls(toolsData: ToolData[]): ToolData[] {
        return toolsData.map((tool) => ({
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
    private reportUsageStatistics(usage_data: OpenAI.Completions.CompletionUsage[], context: ILLMRequestContext, reportedUsage: any[]): void {
        // Report normal usage
        usage_data.forEach((usage) => {
            const reported = this.deps.reportUsage(usage, this.buildUsageContext(context));
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

    /**
     * Get valid image files based on supported MIME types
     */
    private getValidImageFiles(files: BinaryInput[]): BinaryInput[] {
        return files.filter((file) => this.validImageMimeTypes.includes(file?.mimetype));
    }

    /**
     * Get valid document files based on supported MIME types
     */
    private getValidDocumentFiles(files: BinaryInput[]): BinaryInput[] {
        return files.filter((file) => this.validDocumentMimeTypes.includes(file?.mimetype));
    }

    /**
     * Upload files to storage
     */
    private async uploadFiles(files: BinaryInput[], agentId: string): Promise<BinaryInput[]> {
        const promises = files.map((file) => {
            const binaryInput = BinaryInput.from(file);
            return binaryInput.upload(AccessCandidate.agent(agentId)).then(() => binaryInput);
        });

        return Promise.all(promises);
    }

    /**
     * Process image files with Chat Completions specific formatting
     */
    private async processImageData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const imageData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_IMAGE_SIZE, 'Image', agentId);

            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const url = `data:${file.mimetype};base64,${base64Data}`;

            imageData.push({
                type: 'image_url',
                image_url: { url },
            });
        }

        return imageData;
    }

    /**
     * Process document files with Chat Completions specific formatting
     */
    private async processDocumentData(files: BinaryInput[], agentId: string): Promise<any[]> {
        if (files.length === 0) return [];

        const documentData = [];
        for (const file of files) {
            await this.validateFileSize(file, MAX_DOCUMENT_SIZE, 'Document', agentId);

            const bufferData = await file.readData(AccessCandidate.agent(agentId));
            const base64Data = bufferData.toString('base64');
            const fileData = `data:${file.mimetype};base64,${base64Data}`;
            const filename = await file.getName();

            documentData.push({
                type: 'file',
                file: {
                    file_data: fileData,
                    filename,
                },
            });
        }

        return documentData;
    }

    /**
     * Validate file size before processing
     */
    private async validateFileSize(file: BinaryInput, maxSize: number, fileType: string, agentId: string): Promise<void> {
        await file.ready();
        const fileInfo = await file.getJsonData(AccessCandidate.agent(agentId));
        if (fileInfo.size > maxSize) {
            throw new Error(`${fileType} file size (${fileInfo.size} bytes) exceeds maximum allowed size of ${maxSize} bytes`);
        }
    }

    getInterfaceName(): string {
        return 'chat.completions';
    }

    validateParameters(params: TLLMParams): boolean {
        // Basic validation for Chat Completions parameters
        return !!params.model && Array.isArray(params.messages);
    }

    /**
     * Prepare messages for Chat Completions API
     */
    private async prepareMessages(params: TLLMParams): Promise<OpenAI.ChatCompletionMessageParam[]> {
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
    private handleJsonResponseFormat(
        messages: OpenAI.ChatCompletionMessageParam[],
        params: TLLMParams
    ): { messages: OpenAI.ChatCompletionMessageParam[]; responseFormat: any } {
        const responseFormat = params?.responseFormat || '';
        const messagesCopy = [...messages];
        const paramsCopy = { ...params };

        if (responseFormat === 'json') {
            // We assume that the system message is first item in messages array
            if (messagesCopy?.[0]?.role === TLLMMessageRole.System) {
                messagesCopy[0] = { ...messagesCopy[0], content: messagesCopy[0].content + JSON_RESPONSE_INSTRUCTION };
            } else {
                messagesCopy.unshift({ role: TLLMMessageRole.System, content: JSON_RESPONSE_INSTRUCTION });
            }

            if (supportsJsonResponse(paramsCopy.model as string)) {
                paramsCopy.responseFormat = { type: 'json_object' };
            } else {
                paramsCopy.responseFormat = undefined; // We need to reset it, otherwise 'json' will be passed as a parameter to the OpenAI API
            }
        }

        return { messages: messagesCopy, responseFormat: paramsCopy.responseFormat };
    }
}
