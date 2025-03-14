import { memory } from './stores/memory.svelte';

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
