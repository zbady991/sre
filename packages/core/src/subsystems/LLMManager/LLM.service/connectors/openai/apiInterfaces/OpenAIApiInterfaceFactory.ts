import { OpenAIApiInterface, OpenAIApiContext, OpenAIApiInterfaceFactory as IOpenAIApiInterfaceFactory } from './OpenAIApiInterface';
import { ResponsesApiInterface } from './ResponsesApiInterface';
import { ChatCompletionsApiInterface } from './ChatCompletionsApiInterface';
import { HandlerDependencies } from '../types';

/**
 * Factory for creating OpenAI API interfaces
 * Implements the Factory pattern to provide clean abstraction for different OpenAI API types
 * Each API interface now handles its own streaming functionality
 *
 * Usage:
 * ```typescript
 * const factory = new OpenAIApiInterfaceFactory(deps);
 * const apiInterface = factory.createInterface('responses', context);
 * ```
 */
export class OpenAIApiInterfaceFactory implements IOpenAIApiInterfaceFactory {
    private deps: HandlerDependencies;

    constructor(deps: HandlerDependencies) {
        this.deps = deps;
    }

    /**
     * Create an API interface instance for the specified type
     * @param interfaceType - The type of interface to create ('responses', 'chat.completions')
     * @param context - The context for the interface
     * @returns The appropriate OpenAI API interface instance
     */
    createInterface(interfaceType: string, context: OpenAIApiContext): OpenAIApiInterface {
        switch (interfaceType) {
            case 'responses':
                return new ResponsesApiInterface(context, this.deps);
            case 'chat.completions':
                return new ChatCompletionsApiInterface(context, this.deps);
            default:
                throw new Error(`Unsupported OpenAI API interface type: ${interfaceType}`);
        }
    }

    /**
     * Get list of supported interface types
     * @returns Array of supported interface type strings
     */
    getSupportedInterfaces(): string[] {
        return ['responses', 'chat.completions'];
    }

    /**
     * Check if an interface type is supported
     * @param interfaceType - The interface type to check
     * @returns True if supported, false otherwise
     */
    isInterfaceSupported(interfaceType: string): boolean {
        return this.getSupportedInterfaces().includes(interfaceType);
    }

    /**
     * Get the default interface type
     * @returns The default interface type string
     */
    getDefaultInterfaceType(): string {
        return 'chat.completions';
    }

    /**
     * Get interface type based on model information
     * @param modelInfo - Model information object
     * @returns The appropriate interface type for the model
     */
    getInterfaceTypeFromModelInfo(modelInfo?: any): string {
        return modelInfo?.interface || this.getDefaultInterfaceType();
    }
}
