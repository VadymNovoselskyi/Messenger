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

		sendKeys

	} from '$lib/api.svelte';
	import { generateKeys, getCookie, storedToUsedChat } from '$lib/utils';
	import type { UsedChat, StoredMessage } from '$lib/types/dataTypes';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import { DbService } from '$lib/stores/DbService';
	import { ChatStore } from '$lib/stores/ChatStore';
	import { SignalProtocolStore } from '$lib/stores/SignalProtocolStore';

	let chatStore: ChatStore = $state()!;
	let dbService: DbService;
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
			await sendKeys(keys);
		}

		chatStore = ChatStore.getInstance();
		dbService = await DbService.getInstance();
	});

	$effect(() => {
		const { chatId } = page.params;
		changeChat(chatId);
	});

	async function changeChat(chatId: string) {
		console.log('Changing chat');
		const chat = chatStore.getChat(chatId);
		console.log(chat);
		if (!chat) {
			goto('/');
			return;
		}

		const messages = await dbService.getLatestMessages(chatId);
		console.log(messages);
		chat.messages = messages;
		index = chatStore.indexOf(chat);
		untrack(() => {
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

		const chat = chatStore.getChat(chatId);
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
		<ChatList bind:chats={chatStore.chats} openedIndex={index} {onChatChange} />
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
