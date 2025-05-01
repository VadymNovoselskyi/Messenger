<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import { syncChats, sendMessage, sendPreKeys } from '$lib/api.svelte';
	import { generateKeys, getCookie, getOtherUsername } from '$lib/utils.svelte';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import { SignalProtocolStore } from '$lib/SignalProtocolStore';
	import { chatsStore } from '$lib/ChatsStore.svelte';
	import { messagesStore } from '$lib/MessagesStore.svelte';
	import type { StoredChat, StoredMessage } from '$lib/types/dataTypes';

	let chat = $state<StoredChat | undefined>();
	let messages = $state<StoredMessage[] | undefined>();
	let messageList = $state() as MessageList;

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

		if (!chatsStore.hasLoaded || !messagesStore.hasLoaded) {
			const chatIds = await chatsStore.loadLatestChats();
			await messagesStore.loadLatestMessages(chatIds);
			chatsStore.sortChats();
			syncChats(chatIds);
		}
	});

	$effect(() => {
		const { chatId } = page.params;
		if (!chatsStore.hasLoaded && !messagesStore.hasLoaded) return;
		chat = chatsStore.getChat(chatId);
		if (!chat) {
			goto('/');
			return;
		}
		messages = messagesStore.getChatMessages(chat._id);
	});

	async function sendMessagePrep(event: SubmitEvent) {
		event.preventDefault();
		const messageInput = (event.currentTarget as HTMLFormElement).message as HTMLInputElement;
		const input = messageInput.value;
		if (!input) return;
		messageInput.value = '';

		const { chatId } = page.params;

		const chat = chatsStore.chats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		// // Update UI immediately and reset unread if needed
		sendMessage(chatId, input);
	}
</script>

<svelte:head>
	<title>
		{getOtherUsername(page.params.chatId)}
	</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList chats={chatsStore.chats} lastMessages={messagesStore.getLatestMessages()} />
	</section>

	{#if chatsStore.hasLoaded && messagesStore.hasLoaded && chat}
		{#key chat!._id}
			<MessageList
				bind:this={messageList}
				{chat}
				submitFn={sendMessagePrep}
				messages={messages ?? []}
			/>
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
