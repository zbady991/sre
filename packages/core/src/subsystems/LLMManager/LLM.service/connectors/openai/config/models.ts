/**
 * OpenAI model configuration
 * Centralized model definitions and capabilities
 */

/**
 * Models that support JSON response format
 * This list can be updated via environment variables or config files
 */
export const MODELS_WITH_JSON_RESPONSE = ['gpt-4.5-preview', 'gpt-4o-2024-08-06', 'gpt-4o-mini-2024-07-18', 'gpt-4-turbo', 'gpt-3.5-turbo'];

/**
 * Get models that support JSON response format
 * Can be overridden by environment variable OPENAI_JSON_MODELS
 */
export function getJsonResponseModels(): string[] {
    const envModels = process.env.OPENAI_JSON_MODELS;
    if (envModels) {
        return envModels.split(',').map((model) => model.trim());
    }
    return MODELS_WITH_JSON_RESPONSE;
}

/**
 * Check if a model supports JSON response format
 */
export function supportsJsonResponse(modelName: string): boolean {
    const jsonModels = getJsonResponseModels();
    return jsonModels.includes(modelName);
}
