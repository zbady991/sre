export type LLMParams = {
    apiKey?: string; // for all
    temperature?: number; // for all
    max_tokens?: number; // for OpenAI, cohere, together.ai, Claude
    maxOutputTokens?: number; // for GoogleAI
    stop?: string[] | null; // for OpenAI, together.ai
    stop_sequences?: string[] | null; // for cohere, Claude
    top_p?: number; // for OpenAI, together.ai, Claude
    top_k?: number; // for together.ai, Claude
    topP?: number; // for GoogleAI
    topK?: number; // for GoogleAI
    p?: number; // Top P for cohere
    k?: number; // Top K for cohere
    frequency_penalty?: number; // for OpenAI, cohere
    repetition_penalty?: number; // Frequency Penalty for together.ai
    presence_penalty?: number; // for OpenAI, cohere
};
