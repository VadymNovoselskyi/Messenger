<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import { requestChats } from '$lib/api.svelte';
	import { getCookie } from '$lib/utils';

	import { memory } from '$lib/stores/memory.svelte';
	import ChatList from '$lib/components/ChatList.svelte';

	onMount(() => {
		if (!getCookie('uid') || !getCookie('token')) {
			goto('/login');
			return;
		}
		if (browser && !memory.chats.length) requestChats();
	});
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList bind:chats={memory.chats} />
	</section>

	<section id="chat-display"></section>
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
			grid-template-rows: auto 1fr;
			
			position: relative;
			grid-column: 1;
			grid-row: span 2;

			background-color: var(--primary-bg-color);
			max-height: 94vh;
		}

		#chat-display {
			grid-column: 2;
			grid-row: 1;
			background-color: #3a506b;
		}
	}
</style>
