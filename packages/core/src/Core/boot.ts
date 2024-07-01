import { StorageService } from '@sre/IO/Storage';
import { LLMService } from '@sre/LLMManager/LLM.service';
import SystemEvents from './SystemEvents';
import { CacheService } from '@sre/MemoryManager/Cache.service';

export function boot() {
    const service: any = {};
    service.StorageService = new StorageService();
    service.CacheService = new CacheService();
    service.LLMService = new LLMService();

    SystemEvents.on('SRE:Initialized', () => {
        console.log('SRE Initialized');
        service.LLMService.init();

        SystemEvents.emit('SRE:Booted', service);
    });
}
