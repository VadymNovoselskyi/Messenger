<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import {
		syncActiveChats,
		sendPreKeyBundle,
		syncAllChatsMetadata,
		addPreKeys
	} from '$lib/api/RequestService';
	import { generateEphemeralKeys, generatePreKeyBundle } from '$lib/utils/signalUtils';
	import { getCookie } from '$lib/utils/cookieUtils';

	import { SignalProtocolDb } from '$lib/indexedDB/SignalProtocolDb.svelte';
	import { chatsStore } from '$lib/stores/ChatsStore.svelte';
	import { messagesStore } from '$lib/stores/MessagesStore.svelte';

	onMount(async () => {
		if (!browser) return;
		if (!getCookie('userId') || !getCookie('token')) {
			goto('/login');
			return;
		}
		const store = SignalProtocolDb.getInstance();
		const isFilled = await store.check();
		if (!isFilled) {
			const preKeysBundle = await generatePreKeyBundle(4);
			sendPreKeyBundle(preKeysBundle);
			setTimeout(() => {
				generateEphemeralKeys(96).then((extraPreKeys) => addPreKeys(extraPreKeys));
			}, 10000);
		}

		if (!chatsStore.hasLoaded || !messagesStore.hasLoaded) {
			let incompleteChatIds = await chatsStore.loadLatestChats();
			await messagesStore.loadLatestMessages(incompleteChatIds);

			while (incompleteChatIds.length) incompleteChatIds = await syncActiveChats(incompleteChatIds);
			let isComplete = await syncAllChatsMetadata();
			while (!isComplete) isComplete = await syncAllChatsMetadata();
		}
	});
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>
