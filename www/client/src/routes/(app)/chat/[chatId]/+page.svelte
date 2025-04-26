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
	import { generateKeys, getCookie, getOtherUsername, storedToUsedChat } from '$lib/utils';
	import type { UsedChat, StoredMessage } from '$lib/types/dataTypes';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import { SignalProtocolStore } from '$lib/stores/SignalProtocolStore';
	import { getDbService } from '$lib/dbService.svelte';
	import { chatsStore } from '$lib/stores/ChatsStore.svelte';

	let chat = $derived($chatsStore.find((chat) => chat._id === page.params.chatId));
	let messageList = $state() as MessageList;

	// function onChatChange() {
	// 	if (messageList) messageList.destroy();
	// }

	onMount(async () => {
		if (!browser) return;
		if (!getCookie('userId') || !getCookie('token')) {
			console.log(getCookie('userId'), getCookie('token'));
			goto('/login');
			return;
		}
		if (!$chatsStore.length) await loadAndSyncChats();

		const store = SignalProtocolStore.getInstance();
		const isFilled = await store.check();
		if (!isFilled) {
			const keys = await generateKeys();
			await sendPreKeys(keys);
		}
	});

	$effect(() => {
		const { chatId } = page.params;
		if (!chat) {
			goto('/');
			return;
		}
	});

	async function sendMessagePrep(event: SubmitEvent) {
		event.preventDefault();
		const messageInput = (event.currentTarget as HTMLFormElement).message as HTMLInputElement;
		const input = messageInput.value;
		if (!input) return;
		messageInput.value = '';

		const { chatId } = page.params;

		const chat = $chatsStore.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		// // Update UI immediately and reset unread if needed
		// if (chat.lastSequence) {
		// 	await readAllUpdate(chatId);
		// 	await getExtraMessages(chatId, 0);
		// 	memory.chats = [...memory.chats];
		// }
		sendEncMessage(chatId, input);
	}
</script>

<svelte:head>
	<title>
		{getOtherUsername(page.params.chatId)}
	</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList chats={$chatsStore} />
	</section>

	{#if chat}
		{#key chat._id}
			<MessageList bind:this={messageList} bind:chat submitFn={sendMessagePrep} />
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
