import EventEmitter from 'events';
import OpenAI from 'openai';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { TLLMParams, ILLMRequestContext, TLLMMessageBlock, ToolData, TLLMToolResultMessageBlock } from '@sre/types/LLM.types';

/**
 * Context interface for OpenAI API operations
 */
export interface OpenAIApiContext extends ILLMRequestContext {
    client: OpenAI;
    connector: OpenAIConnector;
}

/**
 * Tool configuration interface
 */
export interface ToolConfig {
    type?: string;
    toolDefinitions: any[];
    toolChoice?: string;
    modelInfo?: any;
}

/**
 * Abstract base class for OpenAI API interfaces
 * Defines the contract that all OpenAI API implementations must follow
 *
 * This follows the Strategy pattern - each API interface (responses, chat.completions)
 * implements this interface with its own specific behavior
 */
export abstract class OpenAIApiInterface {
    protected context: OpenAIApiContext;

    constructor(context: OpenAIApiContext) {
        this.context = context;
    }

    /**
     * Create a regular (non-streaming) request for this API interface
     * @param body - The request body prepared for this API
     * @param context - The request context
     */
    abstract createRequest(body: any, context: ILLMRequestContext): Promise<any>;

    /**
     * Create a stream for this API interface
     * @param body - The request body prepared for this API
     * @param context - The request context
     */
    abstract createStream(body: any, context: ILLMRequestContext): Promise<any>;

    /**
     * Handle the stream response from this API interface
     * @param stream - The stream returned from createStream
     * @param context - The request context
     */
    abstract handleStream(stream: any, context: ILLMRequestContext): EventEmitter;

    /**
     * Prepare the request body for this API interface
     * @param params - The LLM parameters
     */
    abstract prepareRequestBody(params: TLLMParams): Promise<any>;

    /**
     * Transform tools configuration for this API interface
     * @param config - The tool configuration
     */
    abstract transformToolsConfig(config: ToolConfig): any[];

    /**
     * Transform messages for this API interface
     * @param messages - The messages to transform
     */
    abstract transformMessages(messages: any[]): any[];

    /**
     * Transform tool message blocks for this API interface
     * @param messageBlock - The message block containing tool calls
     * @param toolsData - The tools data
     */
    abstract transformToolMessageBlocks(messageBlock: TLLMMessageBlock, toolsData: ToolData[]): TLLMToolResultMessageBlock[];

    /**
     * Handle file attachments for this API interface
     * @param files - The files to attach
     * @param agentId - The agent ID
     * @param messages - The messages to attach files to
     */
    abstract handleFileAttachments(files: BinaryInput[], agentId: string, messages: any[]): Promise<any[]>;

    /**
     * Get the API interface name
     */
    abstract getInterfaceName(): string;

    /**
     * Validate if this interface supports the given parameters
     * @param params - The parameters to validate
     */
    abstract validateParameters(params: TLLMParams): boolean;

    protected async getImageDataForInterface(files: BinaryInput[], agentId: string): Promise<any[]> {
        return this.context.connector.getImageDataForInterface(files, agentId, this.getInterfaceName());
    }

    protected async getDocumentDataForInterface(files: BinaryInput[], agentId: string): Promise<any[]> {
        return this.context.connector.getDocumentDataForInterface(files, agentId, this.getInterfaceName());
    }

    protected getValidImageFiles(files: BinaryInput[]): BinaryInput[] {
        return this.context.connector.getValidImageFiles(files);
    }

    protected getValidDocumentFiles(files: BinaryInput[]): BinaryInput[] {
        return this.context.connector.getValidDocumentFiles(files);
    }

    protected async uploadFiles(files: BinaryInput[], agentId: string): Promise<BinaryInput[]> {
        return this.context.connector.uploadFiles(files, agentId);
    }
}

/**
 * Factory interface for creating OpenAI API interfaces
 */
export interface OpenAIApiInterfaceFactory {
    /**
     * Create an API interface instance for the specified type
     * @param interfaceType - The type of interface to create
     * @param context - The context for the interface
     */
    createInterface(interfaceType: string, context: OpenAIApiContext): OpenAIApiInterface;

    /**
     * Get supported interface types
     */
    getSupportedInterfaces(): string[];
}

// Forward declaration to avoid circular dependency
export interface OpenAIConnector {
    getImageDataForInterface(files: BinaryInput[], agentId: string, interfaceType: string): Promise<any[]>;
    getDocumentDataForInterface(files: BinaryInput[], agentId: string, interfaceType: string): Promise<any[]>;
    getValidImageFiles(files: BinaryInput[]): BinaryInput[];
    getValidDocumentFiles(files: BinaryInput[]): BinaryInput[];
    uploadFiles(files: BinaryInput[], agentId: string): Promise<BinaryInput[]>;
}
