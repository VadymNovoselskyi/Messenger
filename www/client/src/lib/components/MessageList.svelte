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
	let { chat, submitFn }: { chat: UsedChat; submitFn: (event: SubmitEvent) => void } = $props();
	let {
		messages,
		latestMessages,
		unreadCount,
		receivedUnreadCount,
		receivedNewCount,
		lastModified
	} = $derived(chat);

	// Calculate the read count from received messages and latest messages
	const receivedReadCount = $derived(messages.length - receivedUnreadCount + latestMessages.length);

	// Calculate old and total unread counts
	// svelte-ignore state_referenced_locally
	const oldUnreadCount = chat.unreadCount - receivedNewCount;
	const totalUnreadCount = $derived(oldUnreadCount + receivedNewCount);

	// ===============================================================
	// Constants & Variables for Dynamic Message Loading
	// ===============================================================
	const TOP_ANCHOR_INDEX = 0;
	// This value should remain a multiple of 'INIT_MESSAGES' and 'EXTRA_MESSAGES' in the server API.
	const INDEXES_PER_STACK = 20;
	const MAX_STACKS = 5;

	// Variables to track read/unread stacks and index offsets for pagination
	let readStacksLoaded = $state(1);
	let unreadStacksLoaded = $state(0);
	let indexOffset = $state(0);

	let readIndexesToShow = $state(0);
	let unreadIndexesToShow = $state(0);

	let topIndex = $state(0);
	let bottomIndex = $state(0);
	let lastMessages = $state([]) as StoredMessage[];

	// ===============================================================
	// State Variables: Anchors, Scrollbar, and Promises for async messages
	// ===============================================================
	let firstUnreadId = $state<string>();
	let extraMessagesPromise: Promise<void> = $state(Promise.resolve());
	let unreadMessagesPromise: Promise<void> = $state(Promise.resolve());

	// Elements references for scrolling and anchors
	let scrollableContent = $state() as HTMLElement;
	let top_anchor = $state() as HTMLElement;
	let unread_anchor = $state() as HTMLElement;
	let bottom_anchor = $state() as HTMLElement;

	// Scrollbar instance and flag for showing it
	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state<boolean>();

	// ===============================================================
	// Observers for Lazy-loading and Read Detection
	// ===============================================================
	let topObserver = createObserver(handleTopIntersection);
	let bottomObserver = createObserver(handleBottomIntersection);
	let readObserver = createObserver((entry: IntersectionObserverEntry) => {
		// Stop observing the element once read
		readObserver.unobserve(entry.target);
		handleMessageRead();
	}, 0.9);

	// ===============================================================
	// Read Update Stashing Variables
	// ===============================================================
	let stashedReadCount = $state(0);
	let readTimeoutId = $state(0);
	const MAX_STASHED_COUNT = 5;
	const MAX_READ_TIMEOUT = 2000; // in ms

	// ===============================================================
	// Recalculate Indexes: Pagination and Dynamic Loading
	// ===============================================================
	export async function recalculateIndexes(direction: number): Promise<void> {
		let isFullRange = false;
		if (direction === 1) {
			const readThreshold = readStacksLoaded * INDEXES_PER_STACK + indexOffset;
			isFullRange = receivedReadCount >= readThreshold;
		} else if (direction === -1) {
			const unreadThreshold = unreadStacksLoaded * INDEXES_PER_STACK - indexOffset;
			const currentUnreadRange = topIndex - receivedReadCount;
			isFullRange = currentUnreadRange >= unreadThreshold;
		}

		// Adjust stacks or index offset based on range fullness and MAX_STACKS
		if (!isFullRange) null;
		else if (readStacksLoaded + unreadStacksLoaded === MAX_STACKS) {
			if (
				indexOffset ||
				(direction === 1 && unreadStacksLoaded === 0) ||
				(direction === -1 && readStacksLoaded === 0)
			) {
				indexOffset += direction * INDEXES_PER_STACK;
			} else {
				readStacksLoaded += direction;
				unreadStacksLoaded -= direction;
			}
		} else if (direction === 1) {
			readStacksLoaded++;
		} else if (direction === -1) {
			unreadStacksLoaded++;
		}

		// Merge latest messages into main messages if all have been read
		if (totalUnreadCount - receivedUnreadCount === 0 && latestMessages.length) {
			chat.messages = [...chat.messages, ...chat.latestMessages];
			chat.latestMessages = [];
		}

		// ---------------------------------------------------------------
		// Determine stack capacities and update visible indexes.
		// ---------------------------------------------------------------
		const readStackCapacity = readStacksLoaded * INDEXES_PER_STACK;
		const unreadStackCapacity = unreadStacksLoaded * INDEXES_PER_STACK;

		readIndexesToShow = Math.min(receivedReadCount, readStackCapacity);
		unreadIndexesToShow = Math.min(receivedUnreadCount, unreadStackCapacity);

		// Calculate base index and determine top and bottom indexes.
		const baseIndex = receivedReadCount - indexOffset;
		bottomIndex = Math.max(baseIndex - readIndexesToShow, 0);
		topIndex = Math.min(baseIndex + unreadIndexesToShow, messages.length);

		lastMessages = [...messages.slice(bottomIndex, topIndex)];
		await tick();
		requestAnimationFrame(() => null);
	}

	// ===============================================================
	// Reactive Effects for Recalculation on Data Changes
	// ===============================================================
	$effect(() => {
		lastModified;
		untrack(() => {
			// Recalculate if we are at the boundaries of the message list
			if (topIndex >= messages.length - 1 || (topIndex === 0 && messages.length !== 0))
				recalculateIndexes(0);
		});
	});
	$effect(() => {
		receivedNewCount;
		untrack(async () => {
			if (totalUnreadCount >= INDEXES_PER_STACK * MAX_STACKS || !receivedNewCount) return;

			// Disconnect observer and recalc indexes based on unread stacks
			readObserver.disconnect();
			totalUnreadCount <= unreadStacksLoaded * INDEXES_PER_STACK
				? await recalculateIndexes(0)
				: await recalculateIndexes(-1);

			// ---------------------------------------------------------------
			// Compute unread messages remaining and observe them if needed.
			// ---------------------------------------------------------------
			const unreadUnrenderedCount =
				receivedUnreadCount - latestMessages.length - (topIndex - receivedReadCount);
			const leftUnreadCount = receivedUnreadCount - (totalUnreadCount - unreadCount);

			if (unreadUnrenderedCount <= leftUnreadCount && unreadCount && unreadIndexesToShow) {
				const lastMessagesEl = Array.from(document.querySelectorAll('.message'));
				const sliceCount = Math.min(leftUnreadCount - unreadUnrenderedCount, INDEXES_PER_STACK);
				lastMessagesEl.slice(-sliceCount).forEach((message) => readObserver.observe(message));
			}
		});
	});

	// ===============================================================
	// Reactive Statements for Scrollbar and Observer Updates
	// ===============================================================
	$effect(() => {
		messages.length;
		// Update scrollbar visibility when messages are loaded
		if (!showScrollbar && messages.length) {
			showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		}
	});

	$effect(() => {
		if (!top_anchor) return;
		// Re-observe top anchor changes
		topObserver.disconnect();
		topObserver.observe(top_anchor);
	});
	$effect(() => {
		if (!bottom_anchor) return;
		// Re-observe bottom anchor changes
		bottomObserver.disconnect();
		bottomObserver.observe(bottom_anchor);
	});

	$effect(() => {
		console.log(chat.messages);
	});

	// ===============================================================
	// Lifecycle: onMount and destroy
	// ===============================================================
	onMount(async () => {
		// Initial index calculation and anchor setup
		recalculateIndexes(0);
		if (unreadCount) await recalculateIndexes(-1);
		firstUnreadId = (messages[receivedReadCount - 1] ?? [])._id;
		setAnchors();
	});

	// Destroy function to cleanup observers and send final read update
	export function destroy() {
		if (stashedReadCount) {
			clearInterval(readTimeoutId);
			const lastReadIndex =
				messages.length - receivedUnreadCount + (totalUnreadCount - unreadCount) - 1;
			if (lastReadIndex < messages.length) sendReadUpdate(chat._id, messages[lastReadIndex]._id);
		}
		chat.receivedUnreadCount -= totalUnreadCount - unreadCount;

		topObserver.disconnect();
		bottomObserver.disconnect();
		readObserver.disconnect();
	}

	// ===============================================================
	// Intersection Handlers: Top and Bottom
	// ===============================================================

	// Handler when the top anchor comes into view
	async function handleTopIntersection(): Promise<void> {
		// Save current top element ID for scroll position restoration
		const prevTopId = lastMessages[0]._id;

		// Check for dragging and update scrollbar state
		const wasDragging = scrollBar && scrollBar.isDraggingOn();
		if (wasDragging) {
			scrollBar.onMouseUp();
		}

		if (bottomIndex === 0) {
			const extraMessageCount =
				messages.length + latestMessages.length + (totalUnreadCount - receivedUnreadCount);
			extraMessagesPromise = getExtraMessages(chat._id, extraMessageCount);
			await extraMessagesPromise;
		}

		// Recalculate indexes for upward pagination
		await recalculateIndexes(1);

		// Restore previous scroll position with margin adjustment
		const prevTopElement = document.getElementById(prevTopId);
		if (prevTopElement) {
			prevTopElement.scrollIntoView({ behavior: 'instant', block: 'start' });
			const marginAdjustment = 15;
			scrollableContent.scrollTop -= marginAdjustment;
		}

		if (wasDragging) {
			scrollBar.onMouseDown();
		}
	}

	// Handler when the bottom anchor comes into view
	async function handleBottomIntersection(): Promise<void> {
		// Disconnect observer to clear previous observations
		readObserver.disconnect();

		// ---------------------------------------------------------------
		// Update unread count if scrolling fast.
		// ---------------------------------------------------------------
		const currentUnreadDelta = totalUnreadCount - (topIndex - receivedReadCount);
		if (currentUnreadDelta < unreadCount && unreadCount) {
			console.log(currentUnreadDelta, unreadCount);
			const newUnreadCount = totalUnreadCount - topIndex + receivedReadCount;
			chat.unreadCount = newUnreadCount;

			const computedLastReadIndex =
				messages.length -
				receivedUnreadCount +
				totalUnreadCount -
				unreadCount +
				(totalUnreadCount - oldUnreadCount) -
				1;
			if (computedLastReadIndex <= messages.length) {
				sendReadUpdate(chat._id, messages[computedLastReadIndex]._id);
			} else {
				sendReadUpdate(chat._id, messages[messages.length - 1]._id);
			}
		}

		// Check dragging state and update scrollbar
		const wasDragging = scrollBar && scrollBar.isDraggingOn();
		if (wasDragging) {
			scrollBar.onMouseUp();
		}

		// Save current bottom element ID
		const prevBottomId = (lastMessages[lastMessages.length - 1] ?? [])._id;

		const conditionForExtra =
			unreadIndexesToShow - indexOffset >= receivedUnreadCount - latestMessages.length;
		if (unreadCount && conditionForExtra) {
			unreadMessagesPromise = getExtraNewMessages(chat._id, unreadCount);
			await unreadMessagesPromise;
		}

		// Recalculate indexes for downward pagination
		await recalculateIndexes(-1);

		// Restore scroll position with margin adjustment
		const prevBottomElement = document.getElementById(prevBottomId);
		if (prevBottomElement) {
			prevBottomElement.scrollIntoView({ behavior: 'instant', block: 'end' });
			const marginAdjustment = 15;
			scrollableContent.scrollTop += marginAdjustment;
		}

		const unreadUnrenderedCount =
			receivedUnreadCount - latestMessages.length - (topIndex - receivedReadCount);
		const leftUnreadCount = receivedUnreadCount - (totalUnreadCount - unreadCount);
		if (unreadUnrenderedCount <= leftUnreadCount && unreadCount && unreadIndexesToShow) {
			const lastMessagesEl = Array.from(scrollableContent.querySelectorAll('.message'));
			const sliceCount = Math.min(leftUnreadCount - unreadUnrenderedCount, INDEXES_PER_STACK);
			lastMessagesEl.slice(-sliceCount).forEach((message) => readObserver.observe(message));
		}

		if (wasDragging) {
			scrollBar.onMouseDown();
		}
	}

	// ===============================================================
	// Handler for Marking Messages as Read
	// ===============================================================
	async function handleMessageRead() {
		// Decrement unread count
		chat.unreadCount--;

		// Define a common computation for the last-read message index
		const computeLastReadIndex = () =>
			messages.length -
			receivedUnreadCount +
			totalUnreadCount -
			unreadCount +
			(totalUnreadCount - oldUnreadCount) -
			1;

		// Start timeout if no updates are stashed
		if (!stashedReadCount) {
			readTimeoutId = window.setTimeout(() => {
				const lastReadIndex = computeLastReadIndex();
				if (lastReadIndex <= messages.length) {
					sendReadUpdate(chat._id, messages[lastReadIndex]._id);
				} else {
					sendReadUpdate(chat._id, messages[messages.length - 1]._id);
				}
				stashedReadCount = 0;
			}, MAX_READ_TIMEOUT);
		}
		stashedReadCount++;

		// If stashed count exceeds limit, trigger update immediately
		if (stashedReadCount >= MAX_STASHED_COUNT) {
			const lastReadIndex = computeLastReadIndex();
			if (lastReadIndex <= messages.length) {
				sendReadUpdate(chat._id, messages[lastReadIndex]._id);
			} else {
				sendReadUpdate(chat._id, messages[messages.length - 1]._id);
			}
			clearTimeout(readTimeoutId);
			stashedReadCount = 0;
		}
	}

	// ===============================================================
	// Anchor Setup for Scroll Position and Lazy-loading
	// ===============================================================
	async function setAnchors() {
		// Wait for messages to load before setting anchors
		await tick();
		if (!top_anchor && !bottom_anchor) {
			requestAnimationFrame(setAnchors);
			return;
		}

		// Determine whether to show the scrollbar based on content height
		showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		await tick();

		requestAnimationFrame(async () => {
			const scrollAdjustment = 24;
			const scrollTop = unread_anchor
				? unread_anchor.offsetTop - scrollableContent.clientHeight + scrollAdjustment
				: bottom_anchor.offsetTop;
			scrollableContent.scrollTo({
				top: scrollTop,
				behavior: 'instant'
			});
		});

		// Setup observers for anchors and new messages
		requestAnimationFrame(async () => {
			await tick();
			readObserver.disconnect();
			bottomObserver.observe(bottom_anchor);
			if (scrollBar) topObserver.observe(top_anchor);
			if (unreadCount) {
				const lastMessagesEls = Array.from(scrollableContent.querySelectorAll('.message'));
				lastMessagesEls
					.slice(-unreadIndexesToShow)
					.forEach((message) => readObserver.observe(message));
			}
		});
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id="message-list"
	onmouseover={showScrollbar ? scrollBar.show : null}
	onmouseleave={showScrollbar ? scrollBar.hide : null}
	onfocus={showScrollbar ? scrollBar.show : null}
	onblur={showScrollbar ? scrollBar.hide : null}
>
	<section
		id="messages"
		bind:this={scrollableContent}
		onscroll={showScrollbar ? scrollBar.updateThumbPosition : null}
		aria-label="Messages"
	>
		<Loader promise={extraMessagesPromise} />

		{#each lastMessages as { _id, from, plaintext, sendTime, sending }, i (_id)}
			{#if i === TOP_ANCHOR_INDEX && receivedReadCount >= INDEXES_PER_STACK}
				<div bind:this={top_anchor} class="anchor"></div>
			{/if}
			<div
				class="message"
				class:sent={from === getCookie('userId')}
				class:received={from !== getCookie('userId')}
				class:sending
				id={_id}
			>
				<p class="text">{plaintext}</p>
				<p class="sendTime">{formatISODate(sendTime)}</p>
			</div>
			{#if _id === firstUnreadId && totalUnreadCount && i !== lastMessages.length - 1}
				<div bind:this={unread_anchor} id="unread-anchor" class="anchor">Unread Messages</div>
			{/if}
		{/each}
		<div bind:this={bottom_anchor} id="bottom-anchor" class="anchor"></div>

		<Loader promise={unreadMessagesPromise} />
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
