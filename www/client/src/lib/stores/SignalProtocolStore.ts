export class SignalProtocolStore {
	private dbPromise: Promise<IDBDatabase>;
	private dbName: string = 'SignalProtocolStore';
	private storeName: string = 'store';

	constructor() {
		this.dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);

			request.onupgradeneeded = (event) => {
				const db = request.result;
				// Create the object store if it doesn't already exist.
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName);
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Retrieves a value by key.
	 * @param key - The key to retrieve.
	 */
	async get(key: string): Promise<any> {
		const db = await this.dbPromise;
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(this.storeName, 'readonly');
			const store = transaction.objectStore(this.storeName);
			const request = store.get(key);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Puts a value into the store with the given key.
	 * @param key - The key under which the value is stored.
	 * @param value - The value to store.
	 */
	async put(key: string, value: any): Promise<any> {
		const db = await this.dbPromise;
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(this.storeName, 'readwrite');
			const store = transaction.objectStore(this.storeName);
			const request = store.put(value, key);

			request.onsuccess = () => resolve(value);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Removes a value from the store by key.
	 * @param key - The key to remove.
	 */
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

	/**
	 * Check if there is any data in the store.
	 * Returns true if there is at least one key stored; otherwise, false.
	 */
	async check(): Promise<boolean> {
		const db = await this.dbPromise;
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(this.storeName, 'readonly');
			const store = transaction.objectStore(this.storeName);
			const request = store.getAllKeys();

			request.onsuccess = () => {
				// If there is at least one key, data exists in the store.
				resolve(request.result && request.result.length > 0);
			};
			request.onerror = () => reject(request.error);
		});
	}
}
