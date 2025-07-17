/**
 * OpenAI API cost configuration
 * Centralized cost definitions for different models and features
 */

export interface CostConfig {
    [modelName: string]: {
        [contextSize: string]: number;
    };
}

export interface SearchToolCostConfig {
    normalModels: CostConfig;
    miniModels: CostConfig;
}

/**
 * Search tool cost configuration
 * Costs are in dollars per 1000 requests
 */
export const SEARCH_TOOL_COSTS: SearchToolCostConfig = {
    normalModels: {
        'gpt-4.1': {
            low: 30 / 1000,
            medium: 35 / 1000,
            high: 50 / 1000,
        },
        'gpt-4o': {
            low: 30 / 1000,
            medium: 35 / 1000,
            high: 50 / 1000,
        },
        'gpt-4o-search': {
            low: 30 / 1000,
            medium: 35 / 1000,
            high: 50 / 1000,
        },
    },
    miniModels: {
        'gpt-4.1-mini': {
            low: 25 / 1000,
            medium: 27.5 / 1000,
            high: 30 / 1000,
        },
        'gpt-4o-mini': {
            low: 25 / 1000,
            medium: 27.5 / 1000,
            high: 30 / 1000,
        },
        'gpt-4o-mini-search': {
            low: 25 / 1000,
            medium: 27.5 / 1000,
            high: 30 / 1000,
        },
    },
};

/**
 * Get search tool cost for a specific model and context size
 */
export function getSearchToolCost(modelName: string, contextSize: string): number {
    const normalizedModelName = modelName?.replace('@built-in/', '');

    // Check normal models first
    if (SEARCH_TOOL_COSTS.normalModels[normalizedModelName]) {
        return SEARCH_TOOL_COSTS.normalModels[normalizedModelName][contextSize] || 0;
    }

    // Check mini models
    if (SEARCH_TOOL_COSTS.miniModels[normalizedModelName]) {
        return SEARCH_TOOL_COSTS.miniModels[normalizedModelName][contextSize] || 0;
    }

    return 0;
}
