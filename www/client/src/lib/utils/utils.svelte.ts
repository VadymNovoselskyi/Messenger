
/**
 * Formats an ISO date string to a human-readable format.
 * @param isoDate The ISO date string to format.
 * @returns The formatted date string in the "hours:minutes, DD-MM-YYYY" | "hours:minutes, DD-MM" | "hours:minutes" format.
 */
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

/**
 * Generates a random request ID.
 * @returns A random request ID.
 */
export function generateRequestId(): string {
	return Math.random().toString(16).substring(2, 15);
}
