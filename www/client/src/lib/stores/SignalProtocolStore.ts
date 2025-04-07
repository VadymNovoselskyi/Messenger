import * as utils from '$lib/utils';
import {
	type StorageType,
	Direction,
	type KeyPairType
} from '@privacyresearch/libsignal-protocol-typescript';

export class SignalProtocolStore implements StorageType {
	private dbPromise: Promise<IDBDatabase>;
	private dbName: string = 'SignalProtocolStore';
	private storeName: string = 'store';

	constructor() {
		this.dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName);
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	// Base CRUD methods for IndexedDB
	async get(key: string): Promise<any> {
		console.log(`get key: ${key}`);
		const db = await this.dbPromise;
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(this.storeName, 'readonly');
			const store = transaction.objectStore(this.storeName);
			const request = store.get(key);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async put(key: string, value: any): Promise<any> {
		console.log(`put key: ${key}; value: ${value}`);
		const db = await this.dbPromise;
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(this.storeName, 'readwrite');
			const store = transaction.objectStore(this.storeName);
			const request = store.put(value, key);
			request.onsuccess = () => resolve(value);
			request.onerror = () => reject(request.error);
		});
	}

	async remove(key: string): Promise<any> {
		const db = await this.dbPromise;
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(this.storeName, 'readwrite');
			const store = transaction.objectStore(this.storeName);
			const request = store.delete(key);
			request.onsuccess = () => resolve(true);
			request.onerror = () => reject(request.error);
		});
	}

	async check(): Promise<boolean> {
		const db = await this.dbPromise;
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(this.storeName, 'readonly');
			const store = transaction.objectStore(this.storeName);
			const request = store.getAllKeys();
			request.onsuccess = () => resolve(request.result && request.result.length > 0);
			request.onerror = () => reject(request.error);
		});
	}

	// --- Implementation of StorageType interface methods ---

	// Identity & Registration
	async getIdentityKeyPair(): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer }> {
		const keyPair = await this.get('identityKeyPair');
		if (!keyPair) {
			throw new Error('Identity key pair not found');
		}
		return keyPair;
	}

	async getLocalRegistrationId(): Promise<number> {
		const registrationId = await this.get('registrationId');
		if (registrationId === undefined || registrationId === null) {
			throw new Error('Registration ID not found');
		}
		return registrationId;
	}

	// Trusted identity storage
	async isTrustedIdentity(
		identifier: string,
		identityKey: ArrayBuffer,
		direction: Direction
	): Promise<boolean> {
		// Minimal implementation: always trust. Expand as needed.
		return true;
	}

	async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
		await this.put(`identity:${identifier}`, identityKey);
		return true;
	}

	async loadPreKey(keyId: string | number): Promise<KeyPairType<ArrayBuffer> | undefined> {
		return await this.get(`preKey:${keyId}`);
	}

	async storePreKey(keyId: string | number, keyPair: KeyPairType<ArrayBuffer>): Promise<void> {
		await this.put(`preKey:${keyId}`, keyPair);
	}

	async removePreKey(keyId: string | number): Promise<void> {
		await this.remove(`preKey:${keyId}`);
	}

	// Signed PreKey storage – now conforming to StorageType by using KeyPairType<ArrayBuffer>
	async loadSignedPreKey(keyId: string | number): Promise<KeyPairType<ArrayBuffer> | undefined> {
		return await this.get(`signedPreKey:${keyId}`);
	}

	async storeSignedPreKey(
		keyId: string | number,
		keyPair: KeyPairType<ArrayBuffer>
	): Promise<void> {
		await this.put(`signedPreKey:${keyId}`, keyPair);
	}

	async removeSignedPreKey(keyId: string | number): Promise<void> {
		await this.remove(`signedPreKey:${keyId}`);
	}

	// Session storage
	async loadSession(identifier: string): Promise<any> {
		console.log(`loadSession, identifier: ${identifier}`);
		const storedRecord = await this.get(`session:${identifier}`);
		if (!storedRecord) return undefined;
		return storedRecord;
	}

	async storeSession(identifier: string, record: any): Promise<void> {
		const serializedRecord = utils.convertBuffersToBase64(record);
		console.log(
			`storeSession, identifier: ${identifier}; serializedRecord: ${JSON.stringify(serializedRecord)}`
		);
		// Wrap the record in an object that contains a "version" and "sessions" property:
		const wrapper = {
			version: 'v1',
			sessions: {
				[identifier]: serializedRecord
			}
		};
		await this.put(`session:${identifier}`, JSON.stringify(wrapper));
	}

	async removeSession(identifier: string): Promise<boolean> {
		await this.remove(`session:${identifier}`);
		return true;
	}

	async removeAllSessions(identifier: string): Promise<boolean> {
		// Minimal implementation assuming one session per identifier.
		await this.remove(`session:${identifier}`);
		return true;
	}
}
