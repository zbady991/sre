import { StorageService } from '@sre/IO/Storage';
import { LLMService } from '@sre/LLMManager/LLM.service';
import SystemEvents from './SystemEvents';
import { CacheService } from '@sre/MemoryManager/Cache.service';
import { createLogger } from './Logger';
const console = createLogger('Boot');
export function boot() {
    console.debug('SRE Boot sequence started');
    const service: any = {};
    service.StorageService = new StorageService();
    service.CacheService = new CacheService();
    service.LLMService = new LLMService();

    SystemEvents.on('SRE:Initialized', () => {
        console.debug('SRE Initialized');
        service.LLMService.init();

        SystemEvents.emit('SRE:Booted', service);

        console.debug('SRE Boot sequence completed');
    });
}
