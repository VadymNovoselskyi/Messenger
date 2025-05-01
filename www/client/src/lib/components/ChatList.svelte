<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import AddChatButton from '$lib/components/AddChatButton.svelte';

	import { formatISODate, getOtherUsername, getCookie } from '$lib/utils.svelte';
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
	let bottomObserver = $state<IntersectionObserver>();

	let scrollableContent = $state() as HTMLElement;
	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state<boolean>();
	let bottom_anchor = $state() as HTMLElement;

	const INDEXES_PER_STACK = 14;
	//dynamic loading of messages
	let stacksLoaded = $state(1);
	let indexesToShow = $derived(
		(chats?.length || 0) >= stacksLoaded * INDEXES_PER_STACK
			? stacksLoaded * INDEXES_PER_STACK
			: chats?.length || 0
	);
	let lastChats = $derived(chats?.slice(0, indexesToShow));

	onMount(async () => {
		// bottomObserver = createObserver(handleBottomIntersection);
		await checkContentHeight();
	});

	// Effect: re-check content height when derived chat list changes
	$effect(() => {
		lastChats; // dependency for reactivity

		requestAnimationFrame(async () => {
			await tick();
			await checkContentHeight();
		});

		// Start observing bottom anchor for lazy loading after tick
		if (scrollBar) bottomObserver!.observe(bottom_anchor);
	});

	/**
	 * Checks if the scrollable content requires a scrollbar and restores its previous scroll position.
	 */
	async function checkContentHeight() {
		await tick();
		if (!scrollableContent) {
			requestAnimationFrame(checkContentHeight);
			return;
		}

		// Set flag if content overflows container height
		showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;

		// // Reset scroll position to stored value
		// scrollableContent.scrollTop = 0;
		// requestAnimationFrame(() => {
		// 	scrollableContent.scrollTo({
		// 		top: memory.chatsScroll,
		// 		behavior: 'instant'
		// 	});
		// });
	}

	/**
	 * Load more chats on bottom intersection.
	 */
	async function handleBottomIntersection(): Promise<void> {
		const isDragging = scrollBar.isDraggingOn();
		if (isDragging) scrollBar.onMouseUp();

		//load more chats
		stacksLoaded++;

		if (isDragging) {
			await tick();
			scrollBar.onMouseDown();
		}
	}
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

	<div
		id="chats"
		bind:this={scrollableContent}
		onscroll={showScrollbar ? scrollBar.updateThumbPosition : null}
	>
		{#each lastChats as { _id, users, lastSequence, lastModified }, i (_id)}
			<a
				href="{page.url.origin}/chat/{_id}"
				class="chat"
				class:current={page.url.pathname === `/chat/${_id}`}
				onclick={() => {
					if (page.params.chatId !== _id && onChatChange) onChatChange();
				}}
			>
				<img src={''} alt={getOtherUsername(_id)} class="profile-picture" />
				<p class="chat-name">{getOtherUsername(_id)}</p>
				{#if lastSequence - users.find((user) => user._id === getCookie('userId'))!.lastReadSequence}
					<p class="unread-count">
						{lastSequence -
							users.find((user) => user._id === getCookie('userId'))!.lastReadSequence}
					</p>
				{/if}
				<p class="chat-message" class:system-message={!lastMessages[_id]}>
					{lastMessages[_id]?.plaintext ?? 'No messages'}
				</p>
				<p class="send-date">{formatISODate(lastModified)}</p>
			</a>
		{/each}
		<div bind:this={bottom_anchor} class="anchor"></div>
	</div>
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
