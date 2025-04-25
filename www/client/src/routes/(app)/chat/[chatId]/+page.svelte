<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { memory } from '$lib/stores/memory.svelte';

	import {
		loadAndSyncChats,
		getExtraMessages,
		readAllUpdate,
		sendEncMessage,
		sendPreKeys
	} from '$lib/api.svelte';
	import { generateKeys, getCookie, storedToUsedChat } from '$lib/utils';
	import type { UsedChat, StoredMessage } from '$lib/types/dataTypes';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import { DbService } from '$lib/stores/DbService';
	import { ChatsStore } from '$lib/stores/ChatsStore';
	import { SignalProtocolStore } from '$lib/stores/SignalProtocolStore';
	import { chats, chatsStore } from '$lib/chats.svelte';
	import { getDbService } from '$lib/dbService.svelte';

	let chat: UsedChat | undefined = $state();
	let chatChange: number = $state(0); //Workaraound to trigger reinit (made for readAll)
	let index: number | undefined = $state();
	let messageList = $state() as MessageList;

	function onChatChange() {
		if (messageList) messageList.destroy();
	}

	onMount(async () => {
		if (!browser) return;
		if (!getCookie('userId') || !getCookie('token')) {
			console.log(getCookie('userId'), getCookie('token'));
			goto('/login');
			return;
		}
		const store = SignalProtocolStore.getInstance();
		const isFilled = await store.check();
		if (!isFilled) {
			const keys = await generateKeys();
			await sendPreKeys(keys);
		}
	});

	$effect(() => {
		const { chatId } = page.params;
		changeChat(chatId);
	});

	async function changeChat(chatId: string) {
		const newChat = chatsStore.getChat(chatId);
		console.log(newChat);
		if (!newChat) {
			goto('/');
			return;
		}

		const messages = await (await getDbService()).getLatestMessages(chatId);
		console.log(messages);
		newChat.messages = messages;
		index = chatsStore.indexOf(newChat);
		untrack(() => {
			chat = newChat;
			chatChange++;
		});
	}

	async function sendMessagePrep(event: SubmitEvent) {
		event.preventDefault();
		const messageInput = (event.currentTarget as HTMLFormElement).message as HTMLInputElement;
		const input = messageInput.value;
		if (!input) return;
		messageInput.value = '';

		const { chatId } = page.params;

		const chat = chatsStore.getChat(chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		// Update UI immediately and reset unread if needed
		if (chat.unreadCount) {
			await readAllUpdate(chatId);
			await getExtraMessages(chatId, 0);
			memory.chats = [...memory.chats];
		}
		sendEncMessage(chatId, input);
	}
</script>

<svelte:head>
	<title>
		{chat?.users.find((user) => {
			return user._id !== getCookie('userId');
		})?.username || 'Chat'}
	</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList {chats} openedIndex={index} {onChatChange} />
	</section>

	{#if chat}
		{#key chatChange}
			<MessageList bind:this={messageList} {chat} submitFn={sendMessagePrep} />
		{/key}
	{/if}
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: minmax(14rem, 3fr) 8fr;
		height: 94vh;
	}
</style>
