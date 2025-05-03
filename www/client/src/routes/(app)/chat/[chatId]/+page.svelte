<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import { syncActiveChats, sendMessage, sendPreKeys, syncAllChatsMetadata } from '$lib/api.svelte';
	import { generateKeys, getCookie, getOtherUsername } from '$lib/utils.svelte';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import { SignalProtocolStore } from '$lib/SignalProtocolStore';
	import { chatsStore } from '$lib/ChatsStore.svelte';
	import { messagesStore } from '$lib/MessagesStore.svelte';
	import Loader from '$lib/components/Loader.svelte';

	let { chatId } = $derived(page.params);
	let chat = $derived(chatsStore.getChat(chatId));
	let messages = $derived(messagesStore.getChatMessages(chatId));
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
			sendPreKeys(keys);
		}

		if (!chatsStore.hasLoaded || !messagesStore.hasLoaded) {
			let incompleteChatIds = await chatsStore.loadLatestChats();
			await messagesStore.loadLatestMessages(incompleteChatIds);
			chatsStore.sortChats();

			while (incompleteChatIds.length) incompleteChatIds = await syncActiveChats(incompleteChatIds);
			let isComplete = await syncAllChatsMetadata();
			while (!isComplete) isComplete = await syncAllChatsMetadata();
		}
	});

	$effect(() => {
		chatId;
		if (!chatsStore.hasLoaded || !messagesStore.hasLoaded) return;
		untrack(() => {
			if (!chat) {
				goto('/');
				return;
			}
		});
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
	{#if chatsStore.hasLoaded && messagesStore.hasLoaded}
		<ChatList chats={chatsStore.chats} lastMessages={messagesStore.getLastMessages()} />
	{:else}
		<div class="chats-loader">
			<Loader />
		</div>
	{/if}

	<section id="chat-display">
		{#if chatsStore.hasLoaded && messagesStore.hasLoaded && chat}
			{#key chat!._id}
				<MessageList
					bind:this={messageList}
					{chat}
					submitFn={sendMessagePrep}
					messages={messages ?? []}
				/>
			{/key}
		{:else}
			<div class="messages-loader">
				<Loader />
			</div>
		{/if}
	</section>
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: minmax(14rem, 3fr) 8fr;
		height: 94vh;

		#chat-display {
			background-color: #3a506b;
			position: relative;
		}
	}

	.chats-loader {
		justify-self: center;
		align-self: center;
	}

	.messages-loader {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		justify-self: center;
		align-self: center;
	}
</style>
