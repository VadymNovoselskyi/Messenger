import { browser } from '$app/environment';
import { chatsStore } from '$lib/stores/ChatsStore.svelte';
import { getCookie } from './cookieUtils';

/**
 * Gets the metadata of the other user in a chat.
 * @param chatId The _id of the chat.
 * @returns The metadata of the other user in the chat.
 */
export function getOtherUserChatMetadata(chatId: string): {
	_id: string;
	username: string;
	lastReadSequence: number;
} {
	if (!browser) return { _id: '', username: '', lastReadSequence: 0 };
	const chat = chatsStore.getLoadedChat(chatId);
	if (!chat) return { _id: '', username: '', lastReadSequence: 0 };

	const otherUserChatMetadata = chat.users.find((user) => user._id !== getCookie('userId'));
	return otherUserChatMetadata ?? { _id: '', username: '', lastReadSequence: 0 };
}

/**
 * Gets the metadata of the user in a chat.
 * @param chatId The _id of the chat.
 * @returns The metadata of the user in the chat.
 */
export function getMyChatMetadata(chatId: string): {
	_id: string;
	username: string;
	lastReadSequence: number;
} {
	if (!browser) return { _id: '', username: '', lastReadSequence: 0 };
	const chat = chatsStore.getLoadedChat(chatId);
	if (!chat) return { _id: '', username: '', lastReadSequence: 0 };

	const myChatMetadata = chat.users.find((user) => user._id === getCookie('userId'));
	return myChatMetadata ?? { _id: '', username: '', lastReadSequence: 0 };
}
