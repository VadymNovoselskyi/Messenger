<script lang="ts">
	// ===============================================================
	// Imports: Svelte lifecycle functions, components, API & utilities
	// ===============================================================
	import { onMount, tick, untrack } from 'svelte';
	import MessageField from '$lib/components/MessageField.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import { getExtraMessages, getExtraNewMessages, sendReadUpdate } from '$lib/api.svelte';
	import { formatISODate, getCookie, createObserver } from '$lib/utils';
	import type { UsedChat, StoredMessage } from '$lib/types/dataTypes';

	// ===============================================================
	// Props & Derived values from chat
	// ===============================================================
	const {
		chat = $bindable(),
		submitFn
	}: { chat: UsedChat; submitFn: (event: SubmitEvent) => void } = $props();
	const { messages, lastSequence, unreadCount, lastModified } = $derived(chat);
	let newlyReadMessageCount = $state(0);

	const SCROLL_ADJUSTMENT = 24;

	let scrollableContent = $state() as HTMLElement;
	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state<boolean>();

	let topAnchor = $state() as HTMLElement;
	let unreadAnchor = $state() as HTMLElement;
	let bottomAnchor = $state() as HTMLElement;

	// let topObserver = createObserver(handleTopIntersection);
	// let bottomObserver = createObserver(handleBottomIntersection);
	let readObserver = createObserver((entry: IntersectionObserverEntry) => {
		readObserver.unobserve(entry.target);
		handleMessageRead(entry.target);
	}, 0.9);

	onMount(setAnchors);

	// ===============================================================
	// Anchor Setup for Scroll Position and Lazy-loading
	// ===============================================================
	async function setAnchors() {
		await tick();
		if (!topAnchor || !bottomAnchor) {
			requestAnimationFrame(setAnchors);
			return;
		}
		const scrollTop = unreadAnchor
			? unreadAnchor.offsetTop - scrollableContent.clientHeight + SCROLL_ADJUSTMENT
			: bottomAnchor.offsetTop;
		scrollableContent.scrollTo({
			top: scrollTop,
			behavior: 'instant'
		});

		await tick();
		updateUnreadObserver();
	}

	function handleMessageRead(target: Element) {
		newlyReadMessageCount++;
		chat.unreadCount--;

		const messageSequence = messages.findIndex((message) => message._id === target.id);
		console.log(messageSequence);

		// // Define a common computation for the last-read message index
		// const computeLastReadIndex = () =>
		// 	messages.length -
		// 	receivedUnreadCount +
		// 	totalUnreadCount -
		// 	unreadCount +
		// 	(totalUnreadCount - oldUnreadCount) -
		// 	1;

		// // Start timeout if no updates are stashed
		// if (!stashedReadCount) {
		// 	readTimeoutId = window.setTimeout(() => {
		// 		const lastReadIndex = computeLastReadIndex();
		// 		if (lastReadIndex <= messages.length) {
		// 			sendReadUpdate(chat._id, messages[lastReadIndex]._id);
		// 		} else {
		// 			sendReadUpdate(chat._id, messages[messages.length - 1]._id);
		// 		}
		// 		stashedReadCount = 0;
		// 	}, MAX_READ_TIMEOUT);
		// }
		// stashedReadCount++;

		// // If stashed count exceeds limit, trigger update immediately
		// if (stashedReadCount >= MAX_STASHED_COUNT) {
		// 	const lastReadIndex = computeLastReadIndex();
		// 	if (lastReadIndex <= messages.length) {
		// 		sendReadUpdate(chat._id, messages[lastReadIndex]._id);
		// 	} else {
		// 		sendReadUpdate(chat._id, messages[messages.length - 1]._id);
		// 	}
		// 	clearTimeout(readTimeoutId);
		// 	stashedReadCount = 0;
		// }
	}

	function updateUnreadObserver() {
		if (unreadCount && readObserver) {
			const lastMessagesEls = Array.from(scrollableContent.querySelectorAll('.message'));
			lastMessagesEls.slice(-unreadCount).forEach((message) => readObserver.observe(message));
		}
	}

	$effect(() => {
		messages.length;
		if (!showScrollbar && messages.length) {
			// Update scrollbar visibility when messages are loaded
			showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		}
	});

	$effect(() => {
		chat.unreadCount;
		updateUnreadObserver();
	});
</script>

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
		<!-- <Loader promise={extraMessagesPromise} /> -->

		<div bind:this={topAnchor} class="anchor"></div>
		{#each messages as { _id, from, plaintext, sendTime }, i (_id)}
			<div
				class="message"
				class:sent={from === getCookie('userId')}
				class:received={from !== getCookie('userId')}
				id={_id}
			>
				<p class="text">{plaintext}</p>
				<p class="sendTime">{formatISODate(sendTime)}</p>
			</div>
			{#if i === messages.length - unreadCount - newlyReadMessageCount - 1 && unreadCount}
				<div bind:this={unreadAnchor} id="unread-anchor" class="anchor">Unread Messages</div>
			{/if}
		{/each}
		<div bind:this={bottomAnchor} id="bottom-anchor" class="anchor"></div>

		<!-- <Loader promise={unreadMessagesPromise} /> -->
	</section>
	<MessageField {submitFn} />
	{#if showScrollbar}
		<Scrollbar bind:this={scrollBar} {scrollableContent} width={0.4} />
	{/if}
</div>

<style lang="scss">
	#message-list {
		display: grid;
		grid-template-rows: 1fr auto;

		background-color: #3a506b;
		position: relative;
		height: 94vh;
	}

	#messages {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		grid-auto-rows: max-content;

		padding: 0 0.8rem;

		overflow-y: scroll;

		.message {
			position: relative;
			overflow-wrap: break-word;
			overflow-anchor: none;
			padding: 0.6rem;
			border-radius: 1rem;
			margin: 0.8rem 0;
			font-size: 1.1rem;

			&.received {
				grid-column: 1/7;
				background-color: #edf6f9;
			}

			&.sent {
				grid-column: 5/11;
				background-color: #83c5be;
			}

			&.sending {
				background-color: #83c5c08f;
			}

			.sendTime {
				justify-self: end;
				font-size: 0.9rem;
				font-weight: 300;
			}
		}

		.anchor {
			grid-column: 1/-1;
			height: 1px;
			width: 100%;

			&#unread-anchor {
				grid-column: 1/-1;
				display: flex;
				align-items: center;
				margin: 1rem 0;
				color: var(--primary-text-color);

				/* Create the left and right lines with pseudo-elements on the container */
				&::before,
				&::after {
					content: '';
					flex-grow: 1;
					height: 2px;
					background-color: #0065e1;
				}

				/* Reserve a 2rem gap between the text and the lines */
				&::before {
					margin-right: 2rem;
				}

				&::after {
					margin-left: 2rem;
				}
			}

			&#bottom-anchor {
				grid-row: auto;
				overflow-anchor: auto;
			}
		}

		/* Hide scrollbar for IE, Edge, and Firefox */
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */

		/* Hide scrollbar for Chrome, Safari, and Opera */
		&::-webkit-scrollbar {
			display: none;
		}
	}
</style>
