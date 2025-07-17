import EventEmitter from 'events';
import OpenAI from 'openai';
import { ILLMRequestContext, APIKeySource } from '@sre/types/LLM.types';

export enum TToolType {
    WebSearch = 'web_search_preview',
}

export interface IResponseHandler {
    createStream(body: any, context: ILLMRequestContext): Promise<any>;
    handleStream(stream: any, context: ILLMRequestContext): EventEmitter;
}

export type HandlerDependencies = {
    getClient: (context: ILLMRequestContext) => Promise<OpenAI>;
    reportUsage: (
        usage: OpenAI.Completions.CompletionUsage & {
            input_tokens?: number;
            output_tokens?: number;
            input_tokens_details?: { cached_tokens?: number };
            prompt_tokens_details?: { cached_tokens?: number };
            cost?: number;
        },
        metadata: { modelEntryName: string; keySource: APIKeySource; agentId: string; teamId: string }
    ) => any;
};
