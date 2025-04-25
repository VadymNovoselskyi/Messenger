import { ChatsStore } from './stores/ChatsStore';
import type { UsedChat } from './types/dataTypes';

export const chatsStore = ChatsStore.getInstance();
export let chats = $state<UsedChat[]>([]);

// $effect.root(() => {
// 	console.log('Update in the chatsStore');
// 	const unsubscribe = chatsStore.subscribe((latest) => {
// 		console.log("Updating the chats effect")
// 		chats = [...latest];
// 	});
// 	return unsubscribe;
// });
