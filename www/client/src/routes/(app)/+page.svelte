<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import {
		syncActiveChats,
		sendPreKeyBundle,
		syncAllChatsMetadata,
		sendPreKeys
	} from '$lib/api.svelte';
	import { generateEphemeralKeys, generatePreKeyBundle, getCookie } from '$lib/utils.svelte';

	import ChatList from '$lib/components/ChatList.svelte';
	import { SignalProtocolStore } from '$lib/SignalProtocolStore';
	import { chatsStore } from '$lib/ChatsStore.svelte';
	import { messagesStore } from '$lib/MessagesStore.svelte';
	import Loader from '$lib/components/Loader.svelte';

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
			const preKeysBundle = await generatePreKeyBundle(4);
			sendPreKeyBundle(preKeysBundle);
			setTimeout(() => {
				generateEphemeralKeys(96).then((extraPreKeys) => sendPreKeys(extraPreKeys));
			}, 10000);
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
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>

<div id="wrapper">
	{#if chatsStore.hasLoaded && messagesStore.hasLoaded}
		<section id="chats-list">
			<ChatList chats={chatsStore.chats} lastMessages={messagesStore.getLastMessages()} />
		</section>
	{:else}
		<div class="chats-loader">
			<Loader />
		</div>
	{/if}

	<section id="chat-display"></section>
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
