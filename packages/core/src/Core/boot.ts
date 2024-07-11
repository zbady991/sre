import { StorageService } from '@sre/IO/Storage.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import SystemEvents from './SystemEvents';
import { CacheService } from '@sre/MemoryManager/Cache.service';
import { createLogger } from './Logger';
import { TServiceRegistry } from '@sre/types/SRE.types';
const console = createLogger('Boot');

export function boot() {
    console.debug('SRE Boot sequence started');
    const service: TServiceRegistry = {};
    service.Storage = new StorageService();
    service.Cache = new CacheService();
    service.LLM = new LLMService();

    SystemEvents.on('SRE:Initialized', () => {
        console.debug('SRE Initialized');
        for (let key in service) {
            service[key].init();
        }

        SystemEvents.emit('SRE:Booted', service);

        console.debug('SRE Boot sequence completed');
    });
}
