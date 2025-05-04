<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import {
		syncActiveChats,
		sendMessage,
		sendPreKeyBundle,
		syncAllChatsMetadata,
		sendPreKeys
	} from '$lib/api.svelte';
	import {
		generateEphemeralKeys,
		generatePreKeyBundle,
		getCookie,
		getOtherUserChatMetadata
	} from '$lib/utils.svelte';

	import ChatList from '$lib/components/ChatList.svelte';
	import MessageList from '$lib/components/MessageList.svelte';
	import { SignalProtocolStore } from '$lib/SignalProtocolStore';
	import { chatsStore } from '$lib/ChatsStore.svelte';
	import { messagesStore } from '$lib/MessagesStore.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import type { StoredChat } from '$lib/types/dataTypes';
	import { getDbService } from '$lib/DbService.svelte';
	import MessageField from '$lib/components/MessageField.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';

	let { chatId } = $derived(page.params);
	let chat = $derived(chatsStore.getLoadedChat(chatId));
	let messages = $derived(messagesStore.getLoadedChatMessages(chatId));
	let isSyncing = $state(true);
	let showScrollbar = $state(false);
	let scrollBar = $state() as Scrollbar;
	let scrollableContent = $state() as HTMLElement;

	onMount(async () => {
		if (!browser) return;
		if (!getCookie('userId') || !getCookie('token')) {
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
			// const chatIndex = await (await getDbService()).getChatIndex(chatId);
			// console.log(chatIndex);
			// let chatsToSync: string[] = [];
			// if (chat) {
			// 	await syncActiveChats([chatId]);
			// 	chatsToSync = await chatsStore.loadChatsByDate(chat.lastModified);
			// } else chatsToSync = await chatsStore.loadLatestChats();
			// console.log(chatsToSync);
			// await messagesStore.loadLatestMessages(chatsToSync);

			const activeChats = await chatsStore.loadLatestChats();
			await messagesStore.loadLatestMessages(activeChats);
			if (!activeChats.includes(chatId)) goto('/');
			isSyncing = false;

			let incompleteChatIds = activeChats;
			while (incompleteChatIds.length) incompleteChatIds = await syncActiveChats(incompleteChatIds);
			let isComplete = await syncAllChatsMetadata();
			while (!isComplete) isComplete = await syncAllChatsMetadata();
		} else isSyncing = false;
	});

	$effect(() => {
		chatId;
		if (!chatsStore.hasLoaded || !messagesStore.hasLoaded || isSyncing) return;
		untrack(() => {
			if (!chat) {
				goto('/');
				return;
			}
		});
	});

	async function sendMessagePrep(event: SubmitEvent) {
		event.preventDefault();
		const messageInput = (event.currentTarget as HTMLFormElement).message as HTMLInputElement;
		const input = messageInput.value;
		if (!input) return;
		messageInput.value = '';

		const { chatId } = page.params;

		const chat = chatsStore.loadedChats.find((chat) => chat._id === chatId);
		if (!chat) throw new Error(`Chat with id ${chatId} not found`);

		sendMessage(chatId, input);
	}

	$effect(() => {
		if (messages.length && scrollableContent) {
			showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		}
	});
</script>

<svelte:head>
	<title>
		{getOtherUserChatMetadata(page.params.chatId).username}
	</title>
</svelte:head>

{#if chatsStore.hasLoaded && messagesStore.hasLoaded && chat && !isSyncing}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		id="message-list"
		onmouseover={showScrollbar && scrollBar ? scrollBar.show : null}
		onmouseleave={showScrollbar && scrollBar ? scrollBar.hide : null}
		onfocus={showScrollbar && scrollBar ? scrollBar.show : null}
		onblur={showScrollbar && scrollBar ? scrollBar.hide : null}
	>
		<section
			id="messages"
			bind:this={scrollableContent}
			onscroll={showScrollbar && scrollBar ? scrollBar.updateThumbPosition : null}
			aria-label="Messages"
		>
			{#key chat!._id}
				<MessageList {chat} messages={messages ?? []} {scrollBar} />
			{/key}
		</section>

		<MessageField submitFn={sendMessagePrep} />
		{#if showScrollbar}
			<Scrollbar bind:this={scrollBar} {scrollableContent} width={0.4} />
		{/if}
	</div>
{:else}
	<div class="messages-loader">
		<Loader />
	</div>
{/if}

<style lang="scss">
	#message-list {
		display: grid;
		grid-template-rows: 1fr auto;

		background-color: #3a506b;
		position: relative;
		height: 94vh;
		overflow: hidden;

		#messages {
			overflow-y: scroll;

			/* Hide scrollbar for IE, Edge, and Firefox */
			-ms-overflow-style: none; /* IE and Edge */
			scrollbar-width: none; /* Firefox */

			/* Hide scrollbar for Chrome, Safari, and Opera */
			&::-webkit-scrollbar {
				display: none;
			}
		}
	}

	.messages-loader {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		justify-self: center;
		align-self: center;
	}
</style>
