<script lang="ts">
	import type { Link } from '$lib/types/dataTypes';
	import Nav from '$lib/components/Nav.svelte';
	import '$lib/style.scss';
	import './app-style.scss';
	import { chatsStore } from '$lib/stores/ChatsStore.svelte';
	import ChatList from '$lib/components/ChatList.svelte';
	import { messagesStore } from '$lib/stores/MessagesStore.svelte';
	import Loader from '$lib/components/Loader.svelte';

	const links: Link[] = [
		{ path: '/', title: 'Chats', pathsToCheck: ['/', '/chat'] },
		{ path: '/search', title: 'Search' },
		{ path: '/profile', title: 'Profile' },
		{ path: '/settings', title: 'Settings' }
	];
	const id = 'toolbar';
</script>

<div id="app">
	<main>
		<div id="wrapper">
			{#if chatsStore.hasLoaded && messagesStore.hasLoaded}
				<section id="chats-list">
					<ChatList chats={chatsStore.loadedChats} lastMessages={messagesStore.lastMessages} />
				</section>
			{:else}
				<div class="chats-loader">
					<Loader />
				</div>
			{/if}

			<section id="chat-display">
				<slot />
			</section>
		</div>
	</main>

	<Nav {links} {id} />
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: minmax(14rem, 3fr) 8fr;
		height: 94vh;

		#chat-display {
			background-color: #3a506b;
		}
	}

	.chats-loader {
		justify-self: center;
		align-self: center;
	}
</style>
