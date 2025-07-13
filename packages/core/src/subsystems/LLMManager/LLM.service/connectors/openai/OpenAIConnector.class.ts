import EventEmitter from 'events';
import OpenAI, { toFile } from 'openai';
import { encodeChat } from 'gpt-tokenizer';

import { BUILT_IN_MODEL_PREFIX } from '@sre/constants';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { LLMHelper } from '@sre/LLMManager/LLM.helper';
import { SUPPORTED_MIME_TYPES_MAP } from '@sre/constants';

import {
    TLLMParams,
    ToolData,
    TLLMMessageBlock,
    TLLMToolResultMessageBlock,
    TLLMMessageRole,
    APIKeySource,
    ILLMRequestFuncParams,
    TOpenAIRequestBody,
    TLLMChatResponse,
    ILLMRequestContext,
    BasicCredentials,
} from '@sre/types/LLM.types';

import { LLMConnector } from '../../LLMConnector';
import { SystemEvents } from '@sre/Core/SystemEvents';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { HandlerDependencies, TToolType } from './types';
import { OpenAIApiInterfaceFactory, OpenAIApiInterface, OpenAIApiContext } from './apiInterfaces';

type TSearchContextSize = 'low' | 'medium' | 'high';
type TSearchLocation = {
    type: 'approximate';
    city?: string;
    country?: string;
    region?: string;
    timezone?: string;
};

export class OpenAIConnector extends LLMConnector {
    public name = 'LLM:OpenAI';

    private interfaceFactory: OpenAIApiInterfaceFactory;
    private validImageMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.image;
    private validDocumentMimeTypes = SUPPORTED_MIME_TYPES_MAP.OpenAI.document;

    constructor() {
        super();

        const deps: HandlerDependencies = {
            getClient: (context) => this.getClient(context),
            reportUsage: (usage, metadata) => this.reportUsage(usage, metadata),
        };

        this.interfaceFactory = new OpenAIApiInterfaceFactory(deps);
    }

    /**
     * Get the appropriate API interface for the given interface type and context
     */
    private getApiInterface(interfaceType: string, context: ILLMRequestContext): OpenAIApiInterface {
        const apiContext: OpenAIApiContext = {
            ...context,
            client: null, // Will be set by the interface when needed
            connector: this as any, // Type assertion to avoid circular dependency
        };
        return this.interfaceFactory.createInterface(interfaceType, apiContext);
    }

    protected async getClient(params: ILLMRequestContext): Promise<OpenAI> {
        const apiKey = (params.credentials as BasicCredentials)?.apiKey;
        const baseURL = params?.modelInfo?.baseURL;

        if (!apiKey) throw new Error('Please provide an API key for OpenAI');

        const openai = new OpenAI({ baseURL, apiKey });

        return openai;
    }

    protected async request({ acRequest, body, context }: ILLMRequestFuncParams): Promise<TLLMChatResponse> {
        const _body = body as OpenAI.ChatCompletionCreateParams;

        try {
            // #region Validate token limit
            const messages = _body?.messages || [];
            const lastMessage = messages[messages.length - 1];

            const promptTokens = context?.hasFiles
                ? await LLMHelper.countVisionPromptTokens(lastMessage?.content)
                : encodeChat(messages as any, 'gpt-4')?.length;

            await this.validateTokenLimit({
                acRequest,
                promptTokens,
                context,
                maxTokens: _body.max_completion_tokens,
            });
            // #endregion Validate token limit

            const responseInterface = this.interfaceFactory.getInterfaceTypeFromModelInfo(context.modelInfo);
            const apiInterface = this.getApiInterface(responseInterface, context);
            const result = await apiInterface.createRequest(body, context);
            const message = result?.choices?.[0]?.message;
            const finishReason = result?.choices?.[0]?.finish_reason;

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

            const usage = result?.usage;
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
        } catch (error: any) {
            throw error;
        }
    }

    protected async streamRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<EventEmitter> {
        try {
            // #region Validate token limit
            const messages = body?.messages || body?.input || [];
            const lastMessage = messages[messages.length - 1];

            const promptTokens = context?.hasFiles
                ? await LLMHelper.countVisionPromptTokens(lastMessage?.content)
                : encodeChat(messages as any, 'gpt-4')?.length;

            await this.validateTokenLimit({
                acRequest,
                promptTokens,
                context,
                maxTokens: body.max_completion_tokens,
            });
            // #endregion Validate token limit

            const responseInterface = this.interfaceFactory.getInterfaceTypeFromModelInfo(context.modelInfo);
            const apiInterface = this.getApiInterface(responseInterface, context);
            const stream = await apiInterface.createStream(body, context);
            const emitter = apiInterface.handleStream(stream, context);

            return emitter;
        } catch (error: any) {
            throw error;
        }
    }

    // #region Image Generation, will be moved to a different subsystem
    protected async imageGenRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<OpenAI.ImagesResponse> {
        try {
            const openai = await this.getClient(context);
            const response = await openai.images.generate(body as OpenAI.Images.ImageGenerateParams);

            return response;
        } catch (error: any) {
            throw error;
        }
    }

    protected async imageEditRequest({ acRequest, body, context }: ILLMRequestFuncParams): Promise<OpenAI.ImagesResponse> {
        const _body = body as OpenAI.Images.ImageEditParams;

        try {
            const openai = await this.getClient(context);
            const response = await openai.images.edit(_body);

            return response;
        } catch (error: any) {
            throw error;
        }
    }

    private async processImageData(files: BinaryInput[], agentId: string): Promise<any[]> {
        const validSources = this.getValidImageFiles(files);
        if (validSources.length === 0) {
            return [];
        }
        return await this.getImageDataForInterface(validSources, agentId, 'chat.completions');
    }

    public getValidDocumentFiles(files: BinaryInput[]): BinaryInput[] {
        const validSources = [];
        for (let file of files) {
            if (this.validDocumentMimeTypes.includes(file?.mimetype)) {
                validSources.push(file);
            }
        }

        return validSources;
    }

    public async uploadFiles(files: BinaryInput[], agentId: string): Promise<BinaryInput[]> {
        const promises = [];
        const _files = [];

        for (let file of files) {
            const binaryInput = BinaryInput.from(file);
            promises.push(binaryInput.upload(AccessCandidate.agent(agentId)));
            _files.push(binaryInput);
        }

        await Promise.all(promises);
        return _files;
    }

    private async processDocumentData(files: BinaryInput[], agentId: string): Promise<any[]> {
        const validSources = this.getValidDocumentFiles(files);
        if (validSources.length === 0) {
            return [];
        }
        return await this.getDocumentDataForInterface(validSources, agentId, 'chat.completions');
    }

    protected async reqBodyAdapter(params: TLLMParams): Promise<TOpenAIRequestBody> {
        // Determine the API interface to use for body preparation
        const responseInterface = params.modelInfo?.interface || 'chat.completions';

        // Handle special capabilities first (these override interface type)
        if (params.capabilities?.imageGeneration === true) {
            const capabilityType = params?.files?.length > 0 ? 'image-edit' : 'image-generation';
            return this.prepareRequestBody(params, capabilityType);
        }

        // Use standard interface preparation
        return this.prepareRequestBody(params, responseInterface);
    }

    private async prepareRequestBody(params: TLLMParams, preparationType: string): Promise<TOpenAIRequestBody> {
        // Create a minimal context for body preparation - the interface may need access to model info
        const minimalContext: ILLMRequestContext = {
            modelInfo: params.modelInfo,
            modelEntryName: params.modelEntryName,
            agentId: params.agentId,
            teamId: params.teamId,
            isUserKey: params.isUserKey,
            credentials: params.credentials,
            hasFiles: params.files && params.files.length > 0,
            toolsInfo: params.toolsInfo,
        };

        const preparers = {
            'chat.completions': async () => {
                const apiInterface = this.getApiInterface('chat.completions', minimalContext);
                return apiInterface.prepareRequestBody(params);
            },
            responses: async () => {
                const apiInterface = this.getApiInterface('responses', minimalContext);
                return apiInterface.prepareRequestBody(params);
            },
            'image-generation': () => this.prepareImageGenerationBody(params),
            'image-edit': () => this.prepareImageEditBody(params),
            // Future interfaces can be added here
        };

        const preparer = preparers[preparationType];
        if (!preparer) {
            throw new Error(`Unsupported preparation type: ${preparationType}`);
        }

        return preparer();
    }

    protected reportUsage(
        usage: OpenAI.Completions.CompletionUsage & {
            input_tokens?: number;
            output_tokens?: number;
            input_tokens_details?: { cached_tokens?: number };
            prompt_tokens_details?: { cached_tokens?: number };
            cost?: number; // for web search tool
        },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) {
        // SmythOS (built-in) models have a prefix, so we need to remove it to get the model name
        const modelName = metadata.modelEntryName.replace(BUILT_IN_MODEL_PREFIX, '');

        const inputTokens = usage?.input_tokens || usage?.prompt_tokens - (usage?.prompt_tokens_details?.cached_tokens || 0); // Returned by the search tool

        const outputTokens =
            usage?.output_tokens || // Returned by the search tool
            usage?.completion_tokens ||
            0;

        const cachedInputTokens =
            usage?.input_tokens_details?.cached_tokens || // Returned by the search tool
            usage?.prompt_tokens_details?.cached_tokens ||
            0;

        const usageData = {
            sourceId: `llm:${modelName}`,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            input_tokens_cache_write: 0,
            input_tokens_cache_read: cachedInputTokens,
            cost: usage?.cost || 0, // for web search tool
            keySource: metadata.keySource,
            agentId: metadata.agentId,
            teamId: metadata.teamId,
        };
        SystemEvents.emit('USAGE:LLM', usageData);

        return usageData;
    }

    public formatToolsConfig({ type = 'function', toolDefinitions, toolChoice = 'auto', modelInfo = null }) {
        let tools: any[] = [];

        if (type === 'function') {
            // Get API interface type from model info
            const interfaceType = this.interfaceFactory.getInterfaceTypeFromModelInfo(modelInfo);

            // Create a temporary context to get the interface
            const tempContext: OpenAIApiContext = {
                modelInfo,
                client: null,
                connector: this as any,
            } as OpenAIApiContext;

            const apiInterface = this.interfaceFactory.createInterface(interfaceType, tempContext);

            // Transform tools using the interface
            tools = apiInterface.transformToolsConfig({
                type,
                toolDefinitions,
                toolChoice,
                modelInfo,
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
            role: TLLMMessageRole.Tool, // toolData.role as TLLMMessageRole, //should always be 'tool' for OpenAI
            name: toolData.name,
            content: typeof toolData.result === 'string' ? toolData.result : JSON.stringify(toolData.result), // Ensure content is a string
        }));

        return [...messageBlocks, ...transformedToolsData];
    }

    /**
     * Transform messages for different API types
     * Uses the new interface pattern following the same pattern as formatToolsConfig
     */
    public transformMessagesForApiType(messages: any[], apiType: string): any[] {
        // Create a temporary context to get the interface
        const tempContext: OpenAIApiContext = {
            client: null,
            connector: this as any,
        } as OpenAIApiContext;

        const apiInterface = this.interfaceFactory.createInterface(apiType, tempContext);
        return apiInterface.transformMessages(messages);
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

    public getValidImageFiles(files: BinaryInput[]) {
        const validSources = [];

        for (let file of files) {
            if (this.validImageMimeTypes.includes(file?.mimetype)) {
                validSources.push(file);
            }
        }

        return validSources;
    }

    public async getImageDataForInterface(files: BinaryInput[], agentId: string, interfaceType: string = 'chat.completions'): Promise<any[]> {
        const coreImageData = await this.getCoreImageData(files, agentId);
        return coreImageData.map(({ url }) => this.formatImageData(url, interfaceType));
    }

    private formatImageData(url: string, interfaceType: string): any {
        const formatters = {
            'chat.completions': () => ({
                type: 'image_url',
                image_url: { url },
            }),
            responses: () => ({
                type: 'input_image',
                image_url: url,
            }),
            // Future interfaces can be added here
        };

        const formatter = formatters[interfaceType];
        if (!formatter) {
            throw new Error(`Unsupported interface type for image data: ${interfaceType}`);
        }

        return formatter();
    }

    private async getCoreImageData(files: BinaryInput[], agentId: string): Promise<{ url: string; filename: string; mimetype: string }[]> {
        try {
            const imageData = [];

            for (let file of files) {
                const bufferData = await file.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const url = `data:${file.mimetype};base64,${base64Data}`;

                imageData.push({
                    url,
                    filename: await file.getName(),
                    mimetype: file.mimetype,
                });
            }

            return imageData;
        } catch (error) {
            throw error;
        }
    }

    public async getDocumentDataForInterface(files: BinaryInput[], agentId: string, interfaceType: string = 'chat.completions'): Promise<any[]> {
        const coreDocumentData = await this.getCoreDocumentData(files, agentId);
        return coreDocumentData.map(({ fileData, filename }) => this.formatDocumentData(fileData, filename, interfaceType));
    }

    private formatDocumentData(fileData: string, filename: string, interfaceType: string): any {
        const formatters = {
            'chat.completions': () => ({
                type: 'file',
                file: {
                    file_data: fileData,
                    filename,
                },
            }),
            responses: () => ({
                type: 'input_file',
                file: {
                    file_data: fileData,
                    filename,
                },
            }),
            // Future interfaces can be added here
        };

        const formatter = formatters[interfaceType];
        if (!formatter) {
            throw new Error(`Unsupported interface type for document data: ${interfaceType}`);
        }

        return formatter();
    }

    private async getCoreDocumentData(files: BinaryInput[], agentId: string): Promise<{ fileData: string; filename: string; mimetype: string }[]> {
        try {
            const documentData = [];

            // Note: We're embedding the file data in the prompt, but we should ideally be uploading the files to OpenAI first
            // in case we start to support bigger files. Refer to this guide: https://platform.openai.com/docs/guides/pdf-files?api-mode=chat
            for (let file of files) {
                const bufferData = await file.readData(AccessCandidate.agent(agentId));
                const base64Data = bufferData.toString('base64');
                const fileData = `data:${file.mimetype};base64,${base64Data}`;

                documentData.push({
                    fileData,
                    filename: await file.getName(),
                    mimetype: file.mimetype,
                });
            }

            return documentData;
        } catch (error) {
            throw error;
        }
    }

    public getWebSearchTool(params: TLLMParams) {
        const searchCity = params?.webSearchCity;
        const searchCountry = params?.webSearchCountry;
        const searchRegion = params?.webSearchRegion;
        const searchTimezone = params?.webSearchTimezone;

        const location: {
            type: 'approximate';
            city?: string;
            country?: string;
            region?: string;
            timezone?: string;
        } = {
            type: 'approximate', // Required, always be 'approximate' when we implement location
        };

        if (searchCity) location.city = searchCity;
        if (searchCountry) location.country = searchCountry;
        if (searchRegion) location.region = searchRegion;
        if (searchTimezone) location.timezone = searchTimezone;

        const searchTool: {
            type: TToolType.WebSearch;
            search_context_size: TSearchContextSize;
            user_location?: TSearchLocation;
        } = {
            type: TToolType.WebSearch,
            search_context_size: params?.webSearchContextSize || 'medium',
        };

        // Add location only if any location field is provided. Since 'type' is always present, we check if the number of keys in the location object is greater than 1.
        if (Object.keys(location).length > 1) {
            searchTool.user_location = location;
        }

        return searchTool;
    }

    private async validateTokenLimit({
        acRequest,
        maxTokens,
        promptTokens,
        context,
    }: {
        acRequest: AccessRequest;
        maxTokens: number;
        promptTokens: number;
        context: ILLMRequestContext;
    }): Promise<void> {
        const provider = await this.getProvider(acRequest, context.modelEntryName);

        await provider.validateTokensLimit({
            model: context.modelEntryName,
            promptTokens,
            completionTokens: maxTokens,
            hasAPIKey: context.isUserKey,
        });
    }

    private async getProvider(acRequest: AccessRequest, modelEntryName: string) {
        const modelsProviderConnector = ConnectorService.getModelsProviderConnector();
        const modelsProvider = modelsProviderConnector.requester(acRequest.candidate as AccessCandidate);

        return modelsProvider;
    }

    /**
     * Prepare request body for OpenAI Responses API
     * Uses MessageTransformer and ToolsTransformer for clean interface transformations
     */

    private async prepareImageGenerationBody(params: TLLMParams): Promise<OpenAI.Images.ImageGenerateParams> {
        const { model, size, quality, n, responseFormat, style } = params;

        const body: OpenAI.Images.ImageGenerateParams = {
            prompt: params.prompt,
            model: model as string,
            size: size as OpenAI.Images.ImageGenerateParams['size'],
            n: n || 1,
        };

        if (quality) {
            body.quality = quality;
        }

        // * Models like 'gpt-image-1' do not support the 'response_format' parameter, so we only set it when explicitly specified.
        if (responseFormat) {
            body.response_format = responseFormat;
        }

        if (style) {
            body.style = style;
        }

        return body;
    }

    private async prepareImageEditBody(params: TLLMParams): Promise<OpenAI.Images.ImageEditParams> {
        const { model, size, n, responseFormat } = params;

        const body: OpenAI.Images.ImageEditParams = {
            prompt: params.prompt,
            model: model as string,
            size: size as OpenAI.Images.ImageEditParams['size'],
            n: n || 1,
            image: null,
        };

        // * Models like 'gpt-image-1' do not support the 'response_format' parameter, so we only set it when explicitly specified.
        if (responseFormat) {
            body.response_format = responseFormat;
        }

        const files: BinaryInput[] = params?.files || [];

        if (files.length > 0) {
            const images = await Promise.all(
                files.map(
                    async (file) =>
                        await toFile(await file.getReadStream(), await file.getName(), {
                            type: file.mimetype,
                        })
                )
            );

            body.image = images;
        }

        return body;
    }
}
