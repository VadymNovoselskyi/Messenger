export function formatISODate(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    
    const isSameYear = date.getFullYear() === now.getFullYear();
    if(!isSameYear) return `${date.getHours()}:${date.getMinutes()}, ${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
    
    const isSameDay = date.getDate() === now.getDate();
    const isSameMonth = date.getMonth() === now.getMonth();
    if(!isSameDay || !isSameMonth) return `${date.getHours()}:${date.getMinutes()}, ${date.getDate()}-${date.getMonth() + 1}`;

    return `${date.getHours()}:${date.getMinutes()}`;
}