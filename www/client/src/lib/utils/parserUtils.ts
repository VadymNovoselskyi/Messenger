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
