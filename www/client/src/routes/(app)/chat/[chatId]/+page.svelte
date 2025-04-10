<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { memory } from '$lib/stores/memory.svelte';

	import { getChats, getExtraMessages, readAllUpdate, sendMessage } from '$lib/api.svelte';
	import { getCookie } from '$lib/utils';
	import type { Chat, Message } from '$lib/types';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';

	let chat: Chat | undefined = $state();
	let chantChange: number = $state(0); //Workaraound to trigger reinit (made for readAll)
	let index: number | undefined = $state();
	let messageList = $state() as MessageList;

	function onChatChange() {
		if (messageList) messageList.destroy();
	}

	onMount(() => {
		if (!getCookie('userId') || !getCookie('token')) {
			console.log(getCookie('userId'), getCookie('token'));
			goto('/login');
			return;
		}
		if (browser && !memory.chats.length) getChats();
	});

	$effect(() => {
		const { chatId } = page.params;
		chat = memory.chats.find((c) => c._id === chatId);
		if (chat) index = memory.chats.indexOf(chat);
		else if (memory.chats.length) goto('/');
		untrack(() => {
			chantChange++;
		});
	});

	async function sendMessagePrep(event: SubmitEvent) {
		event.preventDefault();
		const messageInput = (event.currentTarget as HTMLFormElement).message as HTMLInputElement;
		const input = messageInput.value;
		if (!input) return;
		messageInput.value = '';

		const { chatId } = page.params;
		const chat = memory.chats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		// Update UI immediately and reset unread if needed
		if (chat.unreadCount) {
			await readAllUpdate(chatId);
			await getExtraMessages(chatId, 0);
			memory.chats = [...memory.chats];
		}
		sendMessage(chatId, input);
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
		<ChatList bind:chats={memory.chats} openedIndex={index} {onChatChange} />
	</section>

	{#if chat}
		{#key chantChange}
			<!-- re-renders the component when chats change -->
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
