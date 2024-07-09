import { AxiosRequestConfig } from 'axios';
import Joi from 'joi';

import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';

function parseComponentAnnotations(source, templateSettings) {
    const arrRegex = new RegExp(/{{([A-Z]+):([\w\s]+):\[(.*?)\]}}/gm);
    const jsonRegex = new RegExp(/{{([A-Z]+):([\w\s]+):(\{.*?\})}}/gm);

    const matches = [...source.matchAll(arrRegex), ...source.matchAll(jsonRegex)];
    for (const match of matches) {
        const label = match[2];
        if (!label) continue;

        const entry: any = Object.values(templateSettings).find((o: any) => o.label == label);
        if (!entry) continue;

        source = source.replace(match[0], `{{${entry.id}}}`);
    }
    return source;
}
export default class APICall extends Component {
    protected configSchema = Joi.object({
        method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD').required().label('Method'),
        url: Joi.string()
            .max(8192) /*.custom(isUrlValid, 'URL validation')*/
            .required()
            .label('URL'),
        headers: Joi.string().allow('').label('Headers'),
        contentType: Joi.string()
            .valid('none', 'application/json', 'multipart/form-data', 'binary', 'application/x-www-form-urlencoded', 'text/plain', 'application/xml')
            .label('Content-Type'),
        body: Joi.string().allow('').label('Body'),
        _templateSettings: Joi.object().allow(null).label('Template Settings'),
        _templateVars: Joi.object().allow(null).label('Template Variables'),
        proxy: Joi.string().allow('').label('Proxy'),
        oauthService: Joi.string().allow('').label('OAuth Service'),
        scope: Joi.string().allow('').label('Scope'),
        authorizationURL: Joi.string().allow('').label('Authorization URL'),
        tokenURL: Joi.string().allow('').label('Token URL'),
        clientID: Joi.string().allow('').label('Client ID'),
        clientSecret: Joi.string().allow('').label('Client Secret'),
        oauth2CallbackURL: Joi.string().allow('').label('OAuth2 Callback URL'),
        callbackURL: Joi.string().allow('').label('Callback URL'), // !TEMP: prevent validation error
        requestTokenURL: Joi.string().allow('').label('Request Token URL'),
        accessTokenURL: Joi.string().allow('').label('Access Token URL'),
        userAuthorizationURL: Joi.string().allow('').label('User Authorization URL'),
        consumerKey: Joi.string().allow('').label('Consumer Key'),
        consumerSecret: Joi.string().allow('').label('Consumer Secret'),
        oauth1CallbackURL: Joi.string().allow('').label('OAuth1 Callback URL'),
        authenticate: Joi.string().allow('').label('Authenticate'),
    });
    constructor() {
        super();
    }

    init() {}

    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config.name);
        const _error: any = undefined;
        try {
            logger.debug(`=== API Call Log ===`);
            // addittionalParams will collect values that oauth1.0 header require for signature
            let additionalParams: any = {},
                rootUrl: any = null;
            const templateSettings = config?.template?.settings || {};

            const reqConfig: AxiosRequestConfig = {};

            /*
                We're experiencing an issue displaying binary data as a string in the debug log.
                To address this, we need to create 'dataForDebug' specifically for the debug log to avoid converting binary data into a string.
            */
            let dataForDebug;

            /* === Request Method === */
            const method = config?.data?.method || 'get';

            reqConfig.method = method;

            let _url = config?.data?.url;

            return { Response: {}, Headers: {}, _error, _debug: logger.output };
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
