import { browser } from '$app/environment';
import { DbService } from './stores/DbService';

let instancePromise: Promise<DbService> | null = null;
export function getDbService(): Promise<DbService> {
	if (!browser) {
		return Promise.reject(new Error('DbService only available in the browser'));
	}
	if (!instancePromise) {
		instancePromise = DbService.getInstance();
	}
	return instancePromise;
}
