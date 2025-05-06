<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import AddChatButton from '$lib/components/AddChatButton.svelte';
	import { PaginationService } from '$lib/services/PaginationService.svelte';
	import { getChatsDbService } from '$lib/indexedDB/ChatsDbService.svelte';
	import { chatsStore } from '$lib/stores/ChatsStore.svelte';
	import { messagesStore } from '$lib/stores/MessagesStore.svelte';

	import { formatISODate } from '$lib/utils/utils.svelte';
	import { getOtherUserChatMetadata, getMyChatMetadata } from '$lib/utils/chatMetadataUtils.svelte';
	import type { StoredChat, StoredMessage } from '$lib/types/dataTypes';

	const {
		chats,
		lastMessages,
		onChatChange
	}: {
		chats: StoredChat[];
		lastMessages: Record<string, StoredMessage | undefined>;
		onChatChange?: () => void;
	} = $props();

	let showAddChat = $state(false);

	let scrollableContent = $state() as HTMLElement;
	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state(false);

	let topAnchor = $state() as HTMLElement;
	let bottomAnchor = $state() as HTMLElement;

	const topObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			handleTopIntersection();
		}
	});
	const bottomObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			handleBottomIntersection();
		}
	});

	async function handleTopIntersection() {
		const prevTopEl = paginationService.paginatedElements[0];
		if (!prevTopEl) return;
		const prevTopId = prevTopEl._id;

		const wasDragging = scrollBar && scrollBar.isDraggingOn();
		if (wasDragging) scrollBar.onMouseUp();

		await paginationService.changePage('UP');
		await tick();

		const prevTopElement = document.getElementById(prevTopId);
		if (prevTopElement) prevTopElement.scrollIntoView({ behavior: 'instant', block: 'start' });

		if (wasDragging) scrollBar.onMouseDown();
	}

	async function handleBottomIntersection() {
		const prevBottomEl = paginationService.paginatedElements.at(-1);
		if (!prevBottomEl) return;
		const prevBottomId = prevBottomEl._id;

		const wasDragging = scrollBar && scrollBar.isDraggingOn();
		if (wasDragging) scrollBar.onMouseUp();

		await paginationService.changePage('DOWN');
		await tick();

		const prevBottomElement = document.getElementById(prevBottomId);
		if (prevBottomElement) prevBottomElement.scrollIntoView({ behavior: 'instant', block: 'end' });

		if (wasDragging) scrollBar.onMouseDown();
	}

	const MAX_PAGES = 5;
	const PAGE_SIZE = 6;
	const paginationService = new PaginationService<StoredChat>(
		chats,
		MAX_PAGES,
		PAGE_SIZE,
		chatsStore.chatsCount,
		async (direction, elements) => {
			let lastModified: string | undefined;
			if (direction === 'DOWN') {
				lastModified = elements.at(-1)?.lastModified;
			} else if (direction === 'UP') {
				lastModified = elements.at(0)?.lastModified;
			}
			lastModified ??= new Date().toISOString();

			const newChats = await (
				await getChatsDbService()
			).getChatsByDate(lastModified, PAGE_SIZE, direction);
			return newChats;
		},
		async (elements) => {
			await messagesStore.loadLatestMessages(elements.map((chat) => chat._id));
		}
	);

	onMount(setAnchors);

	async function setAnchors() {
		await tick();
		if (!topAnchor || !bottomAnchor) {
			requestAnimationFrame(setAnchors);
			return;
		}

		topObserver.observe(topAnchor);
		bottomObserver.observe(bottomAnchor);
	}

	$effect(() => {
		paginationService.totalLength = chatsStore.chatsCount;
	});

	$effect(() => {
		if (!showScrollbar && chats.length) {
			showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id="chats-section"
	onmouseover={showScrollbar ? scrollBar.show : null}
	onmouseleave={showScrollbar ? scrollBar.hide : null}
	onfocus={showScrollbar ? scrollBar.show : null}
	onblur={showScrollbar ? scrollBar.hide : null}
>
	<h1 id="chats-list-title">Chats</h1>

	<section
		id="chats"
		bind:this={scrollableContent}
		onscroll={showScrollbar ? scrollBar.updateThumbPosition : null}
	>
		<div bind:this={topAnchor} class="anchor"></div>
		{#each paginationService.paginatedElements as { _id, lastSequence, lastModified } (_id)}
			<a
				href="{page.url.origin}/chat/{_id}"
				class="chat"
				id={_id}
				class:current={page.url.pathname === `/chat/${_id}`}
				onclick={() => {
					if (page.params.chatId !== _id && onChatChange) onChatChange();
				}}
			>
				<img src={''} alt={getOtherUserChatMetadata(_id).username} class="profile-picture" />
				<p class="chat-name">{getOtherUserChatMetadata(_id).username}</p>
				{#if lastSequence - getMyChatMetadata(_id).lastReadSequence}
					<p class="unread-count">
						{lastSequence - getMyChatMetadata(_id).lastReadSequence}
					</p>
				{/if}
				<p class="chat-message" class:system-message={!lastMessages[_id]}>
					{lastMessages[_id]?.plaintext ?? 'No messages'}
				</p>
				<p class="send-date">{formatISODate(lastModified)}</p>
			</a>
		{/each}
		<div bind:this={bottomAnchor} class="anchor"></div>
	</section>
	{#if showScrollbar}
		<Scrollbar bind:this={scrollBar} {scrollableContent} width={0.4} />
	{/if}

	<button id="add-chat" onclick={() => (showAddChat = !showAddChat)}>
		<i>+</i>
	</button>
</div>

{#if showAddChat}
	<AddChatButton bind:showAddChat />
{/if}

<style lang="scss">
	#chats-section {
		height: 94vh;
		display: grid;
		grid-template-rows: auto 0 1fr;

		position: relative;
		background-color: var(--primary-bg-color);
	}

	#chats-list-title {
		grid-row: 1;
		padding: 0.6rem 0 0.4rem 0;
		justify-self: center;
		font-size: 1.6rem;
	}

	#chats {
		grid-row: 3;
		overflow: scroll;
		padding: 0 0.4rem;

		.chat {
			display: grid;
			grid-template-columns: auto 1fr auto;
			grid-template-rows: 1.6rem 4rem auto;
			grid-gap: 0 1rem;
			align-items: center;
			padding: 0.4rem;
			border: 1px solid var(--secondary-bg-color);
			text-decoration: none;

			&:hover {
				cursor: pointer;
				background-color: var(--primary-hover-bg-color);
				color: var(--primary-hover-text-color);
			}

			&.current {
				background-color: rgba(51, 102, 153, 0.5);
			}

			.profile-picture {
				grid-column: 1;
				grid-row: span 2;
				width: 64px;
				height: 64px;
			}

			.chat-name {
				grid-column: 2;
				grid-row: 1;

				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				font-weight: 600;
			}

			.unread-count {
				grid-column: 3;
				grid-row: 1;

				text-align: center;
				justify-self: center;

				min-width: 1.6rem;
				height: 1.6rem;
				padding: 0.1rem 0.2rem;

				border: solid #0065e1;
				border-radius: 0.8rem;

				font-size: 1rem;
				font-weight: 600;
				color: #0065e1;
				white-space: nowrap;
			}

			.chat-message {
				grid-column: 2/4;
				grid-row: 2;

				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;

				&.system-message {
					color: #0065e1;
				}
			}

			.send-date {
				grid-column: span 3;
				grid-row: 3;

				justify-self: end;
				font-size: 0.9rem;
				font-weight: 300;
			}
		}

		.anchor {
			height: 1px;
			width: 100%;
		}

		/* Hide scrollbar for IE, Edge, and Firefox */
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */

		/* Hide scrollbar for Chrome, Safari, and Opera */
		&::-webkit-scrollbar {
			display: none;
		}
	}

	#add-chat {
		grid-row: 2;

		position: sticky;

		height: 3rem;
		margin-top: calc(94vh - 6.2rem);
		margin-left: calc(100% - 3.2rem);
		transform: translateX(-0.6rem);

		background-color: #0065e1;
		border: none;
		cursor: pointer;
		border-radius: 0.6rem;
		z-index: 5;

		i {
			color: var(--primary-bg-color);
			font-weight: 900;
			font-size: 2.4rem;
		}
	}
</style>
