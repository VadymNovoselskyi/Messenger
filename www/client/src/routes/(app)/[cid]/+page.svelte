<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { memory } from '$lib/stores/memory.svelte';

	import { requestChats, sendMessage } from '$lib/api.svelte';
	import { getCookie } from '$lib/utils';
	import type { Chat, Message } from '$lib/types';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import MessageField from '$lib/components/MessageField.svelte';

	onMount(() => {
		if (!getCookie('uid') || !getCookie('token')) {
			goto('/login');
			return;
		}
		if (browser && !memory.chats.length) requestChats();
	});

	let messages: Message[] | null = $state()!;
	let chatDisplay: HTMLElement;
	$effect(() => {
		async function scrollToBottom() {
			await tick();
			if (chatDisplay) {
				chatDisplay.scrollTop = chatDisplay.scrollHeight;
			}
		}
		const { cid } = $page.params;
		const chat = memory.chats.find((chat) => chat._id === cid);

		messages = chat ? chat.messages : null;
		scrollToBottom();
	});
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList bind:chats={memory.chats} />
	</section>

	<section id="chat-display" bind:this={chatDisplay}>
		<MessageList {messages} />
	</section>

	<section id="message-field">
		<MessageField submitFn={sendMessage} />
	</section>
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: minmax(14rem, 3fr) 8fr;
		grid-template-rows: 1fr auto;
		height: 94vh;
		overflow: hidden;

		#chats-list {
			display: grid;
			grid-template-rows: 94vh auto;
			
			position: relative;
			grid-column: 1;
			grid-row: span 2;

			background-color: var(--primary-bg-color);
			max-height: 94vh;
		}

		#chat-display {
			grid-column: 2;
			grid-row: 1;
			padding: 0 1rem;

			display: grid;
			grid-template-columns: repeat(10, 1fr);
			grid-auto-rows: max-content;

			background-color: #3a506b;
			max-height: 94vh;
			overflow-y: auto;
			scrollbar-width: thin;
		}

		#message-field {
			grid-column: 2;
			grid-row: 2;
			justify-items: center;

			padding: 0.4rem;
			background-color: #3a506b;
		}
	}
</style>
