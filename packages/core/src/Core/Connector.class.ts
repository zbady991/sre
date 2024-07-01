import { createLogger } from './Logger';

const console = createLogger('Connector');

export abstract class Connector {
    public abstract name: string;
    public async start() {
        console.info(`Starting ${this.name} connector ...`);
    }

    public async stop() {
        console.info(`Stopping ${this.name} connector ...`);
    }
}
