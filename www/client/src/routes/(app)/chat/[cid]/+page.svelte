<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { memory } from '$lib/stores/memory.svelte';

	import { requestChats, sendMessage } from '$lib/api.svelte';
	import { getCookie } from '$lib/utils';
	import type { Chat, Message } from '$lib/types';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';

	onMount(() => {
		if (!getCookie('uid') || !getCookie('token')) {
			goto('/login');
			return;
		}
		if (browser && !memory.chats.length) requestChats();
	});

	let messages: Message[] | null = $state()!;
	let index: number = $state(0);
	$effect(() => {
		const { cid } = page.params;
		const chat = memory.chats.find((chat) => chat._id === cid);
		if(chat) index = memory.chats.indexOf(chat);

		messages = chat ? chat.messages : null;
	});
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList bind:chats={memory.chats} openedIndex={index}/>
	</section>

	<MessageList {messages} submitFn={sendMessage} />
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: minmax(14rem, 3fr) 8fr;
		height: 94vh;
	}
</style>
