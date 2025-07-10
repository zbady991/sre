import EventEmitter from 'events';
import { APIKeySource } from '@sre/types/LLM.types';
import { IResponseHandler, HandlerDependencies } from '../types';
import type { ILLMRequestContext } from '@sre/types/LLM.types';
import { BUILT_IN_MODEL_PREFIX } from '@sre/constants';

// per 1k requests
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

const SEARCH_TOOL_COST = {
    'gpt-4.1': costForNormalModels,
    'gpt-4o': costForNormalModels,
    'gpt-4o-search': costForNormalModels,

    'gpt-4.1-mini': costForMiniModels,
    'gpt-4o-mini': costForMiniModels,
    'gpt-4o-mini-search': costForMiniModels,
};

export class ResponsesHandler implements IResponseHandler {
    constructor(private deps: HandlerDependencies) {}

    async createStream(body: any, context: ILLMRequestContext): Promise<any> {
        const openai = await this.deps.getClient(context);
        return await openai.responses.create({ ...body, stream: true });
    }

    handleStream(stream: any, context: ILLMRequestContext): EventEmitter {
        const emitter = new EventEmitter();
        const usage_data: any[] = [];
        const reportedUsage: any[] = [];
        let finishReason = 'stop';

        // Process stream asynchronously as we need to return emitter immediately
        (async () => {
            let toolsData: any = [];
            let currentToolCall = null;

            for await (const part of stream) {
                // Handle different event types from the stream
                if ('type' in part) {
                    const event = part.type;

                    switch (event) {
                        case 'response.output_text.delta': {
                            if (part?.delta) {
                                // Emit content in delta format for compatibility
                                const deltaMsg = {
                                    role: 'assistant',
                                    content: part.delta,
                                };
                                emitter.emit('data', deltaMsg);
                                emitter.emit('content', part.delta, 'assistant');
                            }
                            break;
                        }
                        // TODO: Handle other events
                        default: {
                            break;
                        }
                    }
                }

                if ('response' in part) {
                    // Handle usage statistics
                    if (part.response?.usage) {
                        usage_data.push(part.response.usage);
                    }
                }
            }

            // #region Report usage statistics
            usage_data.forEach((usage) => {
                const reported = this.reportNormalUsage(usage, context);
                reportedUsage.push(reported);
            });

            if (context.toolsInfo?.webSearch?.enabled) {
                const reported = this.reportSearchToolUsage(context);
                reportedUsage.push(reported);
            }
            // #endregion

            // Emit interrupted event if finishReason is not 'stop'
            if (finishReason !== 'stop') {
                emitter.emit('interrupted', finishReason);
            }

            // Emit end event with same data structure as v1
            setTimeout(() => {
                emitter.emit('end', toolsData, reportedUsage, finishReason);
            }, 100);
        })();

        return emitter;
    }

    /**
     * Build common usage context parameters from request context
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
     * Report normal token usage
     */
    private reportNormalUsage(usage: any, context: ILLMRequestContext) {
        return this.deps.reportUsage(usage, this.buildUsageContext(context));
    }

    /**
     * Report search tool usage with calculated cost
     */
    private reportSearchToolUsage(context: ILLMRequestContext) {
        const modelName = context.modelEntryName?.replace(BUILT_IN_MODEL_PREFIX, '');
        const cost = SEARCH_TOOL_COST?.[modelName]?.[context.toolsInfo?.webSearch?.contextSize] || 0;

        const usage = {
            cost,
            completion_tokens: 0,
            prompt_tokens: 0,
            total_tokens: 0,
        };

        return this.deps.reportUsage(usage, this.buildUsageContext(context));
    }
}
