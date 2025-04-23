import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { memory } from './stores/memory.svelte';
import { SignalProtocolStore } from './stores/SignalProtocolStore';
import type { unorgonizedKeys } from './signalTypes';

export function formatISODate(isoDate: string): string {
	const date = new Date(isoDate);
	const now = new Date();

	const year = date.getFullYear();
	const month = `${date.getMonth() + 1 < 10 ? 0 : ''}${date.getMonth() + 1}`;
	const day = `${date.getDate() < 10 ? 0 : ''}${date.getDate()}`;
	const hours = `${date.getHours() < 10 ? 0 : ''}${date.getHours()}`;
	const minutes = `${date.getMinutes() < 10 ? 0 : ''}${date.getMinutes()}`;

	const isSameYear = date.getFullYear() === now.getFullYear();
	if (!isSameYear) return `${hours}:${minutes}, ${day}-${month}-${year}`;

	const isSameMonth = date.getMonth() === now.getMonth();
	const isSameDay = date.getDate() === now.getDate();
	if (!isSameDay || !isSameMonth) return `${hours}:${minutes}, ${day}-${month}`;

	return `${hours}:${minutes}`;
}

export function generateId(): string {
	return Math.random().toString(16).substring(2, 15);
}

export function setCookie(name: string, value: string, days: number): void {
	const date = new Date();
	date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000); // Expiry in days
	const expires = `expires=${date.toUTCString()}`;
	document.cookie = `${name}=${value}; ${expires}; path=/`;
}

export function getCookie(name: string): string | null {
	const cookies = document.cookie.split('; ');
	for (const cookie of cookies) {
		const [key, value] = cookie.split('=');
		if (key === name) return value;
	}
	return null;
}

export function sortChats(): void {
	memory.chats = memory.chats.sort((a, b) => {
		const aTime: number = new Date(a.lastModified).getTime();
		const bTime: number = new Date(b.lastModified).getTime();
		return bTime - aTime;
	});
}

// Overload signatures
export function createObserver(
	callback: () => Promise<void>,
	threshold?: number
): IntersectionObserver;
export function createObserver(
	callback: (entry: IntersectionObserverEntry) => void,
	threshold?: number
): IntersectionObserver;

// Implementation
export function createObserver(
	callback: (() => Promise<void>) | ((entry: IntersectionObserverEntry) => void),
	threshold: number = 0.5
): IntersectionObserver {
	const intersectionObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					// Check the callback type and invoke accordingly
					if (callback.length === 0) {
						// Callback expects no arguments
						(callback as () => Promise<void>)();
					} else {
						// Callback expects an entry argument
						(callback as (entry: IntersectionObserverEntry) => void)(entry);
					}
				}
			});
		},
		{ threshold }
	);
	return intersectionObserver;
}

export async function generateKeys(): Promise<unorgonizedKeys> {
	const store = new SignalProtocolStore();

	// Generate and store registration ID
	const registrationId = await libsignal.KeyHelper.generateRegistrationId();
	await store.put('registrationId', registrationId);

	// Generate and store identity key pair
	const identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
	await store.put('identityKeyPair', identityKeyPair);

	// Generate and store signed pre-key
	const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, 1);
	await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

	// Generate and store 100 one-time pre-keys
	const oneTimePreKeys: libsignal.PreKeyPairType[] = [];
	for (let i = 0; i < 100; i++) {
		const prekey = await libsignal.KeyHelper.generatePreKey(i + 2);
		oneTimePreKeys.push(prekey);
		await store.storePreKey(prekey.keyId, prekey.keyPair);
	}

	return {
		registrationId,
		identityKeyPair,
		signedPreKey,
		oneTimePreKeys
	};
}

/**
 * Converts an ArrayBuffer to a Base64 encoded string.
 * @param buffer The ArrayBuffer to convert.
 */
export function arrayBufferToBase64(ab: ArrayBuffer): string {
	const bytes = new Uint8Array(ab);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export function convertBuffersToBase64(obj: any): any {
	if (obj instanceof ArrayBuffer) {
		return arrayBufferToBase64(obj);
	} else if (Array.isArray(obj)) {
		return obj.map(convertBuffersToBase64);
	} else if (obj && typeof obj === 'object') {
		const newObj: any = {};
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				newObj[key] = convertBuffersToBase64(obj[key]);
			}
		}
		return newObj;
	}
	return obj;
}

/**
 * Converts a Base64 encoded string back to an ArrayBuffer.
 * @param base64 The Base64 encoded string.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const length = binaryString.length;
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * Converts a JavaScript string to an ArrayBuffer (UTF-8 encoded).
 */
export function textToArrayBuffer(text: string): ArrayBuffer {
	const encoder = new TextEncoder();
	const uint8 = encoder.encode(text);
	const buf = new ArrayBuffer(uint8.length);
	const view = new Uint8Array(buf);
	view.set(uint8);
	return buf;
}

export function convertBase64ToBuffers(obj: any): any {
	// Check if the object is a string that is a valid base64 (you might need a more robust check)
	if (typeof obj === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(obj)) {
		try {
			// Attempt conversion; if it fails, leave it as string.
			return base64ToArrayBuffer(obj);
		} catch (e) {
			return obj;
		}
	} else if (Array.isArray(obj)) {
		return obj.map(convertBase64ToBuffers);
	} else if (obj && typeof obj === 'object') {
		const newObj: any = {};
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				newObj[key] = convertBase64ToBuffers(obj[key]);
			}
		}
		return newObj;
	}
	return obj;
}

export function getOtherUsername(chatId: string): string {
	const chat = memory.chats.find((chat) => chat?._id === chatId);
	if (!chat) throw new Error(`No chat found for chatId: ${chatId}`);

	const otherUser = chat.users.find((user) => user._id !== getCookie('userId'));
	if (!otherUser) throw new Error(`Coulndt find other user for chat: ${chat}`);

	return otherUser.username;
}
