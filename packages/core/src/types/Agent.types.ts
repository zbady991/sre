export type TAgentProcessParams = {
    method: string;
    path: string;
    body?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    params?: any;
};
