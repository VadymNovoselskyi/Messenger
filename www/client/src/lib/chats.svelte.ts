import { ChatsStore } from './stores/ChatsStore';
import type { UsedChat } from './types/dataTypes';

export const chatsStore = ChatsStore.getInstance();
export let chats = $state<UsedChat[]>([]);

$effect.root(() => {
	return chatsStore.subscribe((latest) => {
		chats.splice(0, chats.length, ...latest);
	});
});
