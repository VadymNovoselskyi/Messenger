<script lang="ts">
	import { page } from '$app/stores';
	import { memory } from '$lib/stores/memory.svelte';
	import { requestChats, sendMessage } from '$lib/api.svelte';
	import type { Chat, Message } from '$lib/types';

	import { tick } from 'svelte';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import MessageField from '$lib/components/MessageField.svelte';

	let chatDisplay: HTMLElement;
		
	let chatCount = $derived(memory.chats.length);
	// svelte-ignore state_referenced_locally
	if(!chatCount) { requestChats() }
	
	let cid = $derived($page.params.cid);
	function findMessages():Message[] | null {
		const chat: Chat | undefined = memory.chats.find((chat: Chat) => chat._id === cid);
		return chat ? chat.messages : null;
	}


	$effect(() => {
		async function scrollToBottom() {
			const { cid } = $page.params;
			if (cid) {
				await tick();
				if (chatDisplay) {
					chatDisplay.scrollTop = chatDisplay.scrollHeight;
				}
			}
		}
					
		scrollToBottom();
	});
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<h1 id="chats-list-title">Chats</h1>

		<ChatList chats={memory.chats} /> 
        {#if chatCount == 0}
			<p>Fetching is in progress!</p>
        {/if}
	</section>

	<section id="chat-display" bind:this={chatDisplay}>
		<MessageList messages={findMessages()} />
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
			grid-column: 1;
			grid-row: span 2;
			padding: 2rem 0.4rem;

			background-color: var(--primary-bg-color);
			max-height: 94vh;
			overflow-y: auto;
			scrollbar-width: thin;

			#chats-list-title {
				justify-self: center;
			}
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
			width: 100%;

			padding: 0.4rem;
			background-color: #3a506b;
		}
	}
</style>
