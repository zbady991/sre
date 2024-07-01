import { createLogger } from './Logger';
const console = createLogger('DummyConnector');

export const DummyConnector: any = new Proxy(
    {},
    {
        get: function (target, prop, receiver) {
            // Check if the property being accessed is a function
            if (typeof target[prop] === 'function') {
                return target[prop];
            } else {
                // Return a function that logs "unavailable"
                return function (...args: any[]) {
                    console.warn(`[!!] Unimplemented Connector tried to call : ${prop.toString()} with arguments:`, args);
                };
            }
        },
    }
);
