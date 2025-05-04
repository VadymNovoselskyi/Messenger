/**
 * Sets a cookie with the given name, value, and expiration date.
 * @param name The name of the cookie.
 * @param value The value of the cookie.
 * @param days The number of days until the cookie expires.
 */
export function setCookie(name: string, value: string, days: number): void {
	const date = new Date();
	date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
	const expires = `expires=${date.toUTCString()}`;
	document.cookie = `${name}=${value}; ${expires}; path=/`;
}

/**
 * Gets a cookie with the given name.
 * @param name The name of the cookie.
 * @returns The value of the cookie or null if the cookie does not exist.
 */
export function getCookie(name: string): string | null {
	const cookies = document.cookie.split('; ');
	for (const cookie of cookies) {
		const [key, value] = cookie.split('=');
		if (key === name) return value;
	}
	return null;
}