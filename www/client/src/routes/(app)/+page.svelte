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
		height: 94vh;

		#chat-display { background-color: #3a506b }
	}
</style>
