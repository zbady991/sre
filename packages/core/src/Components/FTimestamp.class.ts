import { Component } from './Component.class';
import { IAgent as Agent } from '@sre/types/Agent.types';
import Joi from 'joi';
import dayjs from 'dayjs';

export class FTimestamp extends Component {
    protected configSchema = Joi.object({
        format: Joi.string()
            .valid('unix', 'iso', 'timestamp')
            .pattern(/^[YMDHhmsSSZzAa\s\-\/:,\.]*$/, 'custom dayjs format')
            .default('unix')
            .label('Timestamp Format')
            .messages({
                'string.pattern.name': 'Custom format contains invalid characters. Use dayjs format tokens like YYYY-MM-DD HH:mm:ss',
                'any.only': 'Format must be "unix", "iso", "timestamp", or a valid dayjs format pattern'
            })
    });

    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            const _error = undefined;
            const format = config.data.format || 'unix';
            const now = dayjs();
            
            let Timestamp: number | string;
            
            switch (format) {
                case 'unix':
                case 'timestamp':
                    Timestamp = Date.now();
                    logger.debug(`Unix timestamp: ${Timestamp}`);
                    break;
                case 'iso':
                    Timestamp = now.toISOString();
                    logger.debug(`ISO timestamp: ${Timestamp}`);
                    break;
                default:
                    // Custom dayjs format
                    try {
                        Timestamp = now.format(format);
                        logger.debug(`Custom formatted timestamp (${format}): ${Timestamp}`);
                    } catch (formatError) {
                        logger.error(`Invalid format string: ${format}`);
                        // Fallback to unix timestamp for invalid formats
                        Timestamp = Date.now();
                        logger.debug(`Fallback unix timestamp: ${Timestamp}`);
                    }
                    break;
            }

            return { Timestamp, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error processing timestamp \n${_error}\n`);
            return { Timestamp: undefined, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
        }
    }
}
