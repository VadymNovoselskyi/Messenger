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

	let chat: Chat | undefined = $state();
	let index: number | undefined = $state();
	$effect(() => {
		const { cid } = page.params;
		chat = memory.chats.find((chat) => chat._id === cid);
		if (chat) index = memory.chats.indexOf(chat);
	});
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList bind:chats={memory.chats} openedIndex={index} />
	</section>

	{#if chat}
		<MessageList {chat} submitFn={sendMessage} />
	{/if}
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: minmax(14rem, 3fr) 8fr;
		height: 94vh;
	}
</style>
