<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import MessageField from '$lib/components/MessageField.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import { getExtraMessages, getExtraNewMessages, sendReadUpdate } from '$lib/api.svelte';
	import { formatISODate, getCookie, createObserver } from '$lib/utils';
	import type { Chat, Message } from '$lib/types';

	let { chat, submitFn }: { chat: Chat; submitFn: (event: SubmitEvent) => void } = $props();
	let {
		messages,
		latestMessages,
		unreadCount,
		receivedUnreadCount,
		receivedNewCount,
		lastModified
	} = $derived(chat);
	let receivedReadCount = $derived(messages.length - receivedUnreadCount);

	// svelte-ignore state_referenced_locally
	const oldUnreadCount = chat.unreadCount - receivedNewCount;
	const totalUnreadCount = $derived(oldUnreadCount + receivedNewCount);

	// svelte-ignore state_referenced_locally
	let firstUnreadId = $state<string>();

	let extraMessagesPromise: Promise<void> = $state(Promise.resolve());
	let unreadMessagesPromise: Promise<void> = $state(Promise.resolve());

	let scrollableContent = $state() as HTMLElement;
	let top_anchor = $state() as HTMLElement;
	let unread_anchor = $state() as HTMLElement;
	let bottom_anchor = $state() as HTMLElement;

	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state<boolean>();

	let topObserver = createObserver(handleTopIntersection);
	let bottomObserver = createObserver(async () => {
		handleBottomIntersection();
	});
	let readObserver = createObserver((entry: IntersectionObserverEntry) => {
		readObserver.unobserve(entry.target);
		handleMessageRead();
	}, 0.9);

	let stashedReadCount = $state(0);
	let readTimeoutId = $state(0);
	const MAX_STASHED_COUNT = 5;
	const MAX_READ_TIMEOUT = 2000; //in ms

	async function handleTopIntersection(): Promise<void> {
		//saves the current top element, to keep the scroll position later
		let prevTopId = lastMessages[0]._id;

		//check if anchor was reached by drag
		let isDragging = false;
		if (scrollBar) isDragging = scrollBar.isDraggingOn();
		if (isDragging) scrollBar.onMouseUp();

		if (topIndex === 0) {
			extraMessagesPromise = getExtraMessages(
				chat._id,
				messages.length + latestMessages.length - receivedUnreadCount + totalUnreadCount
			);
			await extraMessagesPromise;
		}

		await recalculateIndexes(1);

		const prevTopElement = document.getElementById(prevTopId);
		if (prevTopElement) {
			prevTopElement.scrollIntoView({ behavior: 'instant', block: 'start' });
			scrollableContent.scrollTop -= 15; //adjust for margin between messages
		}

		if (isDragging) scrollBar.onMouseDown();
	}

	async function handleBottomIntersection(): Promise<void> {
		readObserver.disconnect(); //disconnect all previous messages

		//accounts for unreliability of intersectionObserver on fast scroll/drag
		if (receivedUnreadCount - (bottomIndex - receivedReadCount) === 0 && unreadCount) {
			console.log('sending read');
			chat.unreadCount = totalUnreadCount - bottomIndex + receivedReadCount;
			const lastReadIndex =
				messages.length - receivedUnreadCount + (totalUnreadCount - unreadCount) - 1;
			if (lastReadIndex < messages.length) sendReadUpdate(chat._id, messages[lastReadIndex]._id);
		}

		//check if anchor was reached by drag
		let isDragging = false;
		if (scrollBar) isDragging = scrollBar.isDraggingOn();
		if (isDragging) scrollBar.onMouseUp();

		//saves the current bottom element, to keep the scroll position later
		const prevBottomId = lastMessages[lastMessages.length - 1]._id;

		if (unreadCount && unreadIndexesToShow - indexOffset >= receivedUnreadCount) {
			unreadMessagesPromise = getExtraNewMessages(chat._id, unreadCount);
			await unreadMessagesPromise;
		}

		await recalculateIndexes(-1);

		const prevBottomElement = document.getElementById(prevBottomId);
		if (prevBottomElement) {
			prevBottomElement.scrollIntoView({ behavior: 'instant', block: 'end' });
			scrollableContent.scrollTop += 15; //adjust for margin between messages
		}

		//number of unread messages that have not been read (that are in the message array)
		const unreadUnrenderedCount = receivedUnreadCount - (bottomIndex - receivedReadCount);
		const leftUnreadCount = receivedUnreadCount - (totalUnreadCount - unreadCount);

		//checks if some unread messages are rendered
		if (unreadIndexesToShow && unreadUnrenderedCount <= leftUnreadCount && unreadCount) {
			const lastMessagesEl = Array.from(scrollableContent.querySelectorAll('.message'));
			lastMessagesEl
				.slice(-Math.min(leftUnreadCount - unreadUnrenderedCount, INDEXES_PER_STACK))
				.forEach((message) => readObserver.observe(message));
		}

		if (isDragging) scrollBar.onMouseDown();
	}

	async function handleMessageRead() {
		chat.unreadCount--;

		if (!stashedReadCount) {
			readTimeoutId = setTimeout(() => {
				const lastReadIndex =
					messages.length - receivedUnreadCount + (totalUnreadCount - unreadCount) - 1;
				sendReadUpdate(chat._id, messages[lastReadIndex]._id);

				stashedReadCount = 0;
			}, MAX_READ_TIMEOUT);
		}
		stashedReadCount++;

		if (stashedReadCount >= MAX_STASHED_COUNT) {
			const lastReadIndex =
				messages.length - receivedUnreadCount + (totalUnreadCount - unreadCount) - 1;

			if (lastReadIndex <= messages.length) sendReadUpdate(chat._id, messages[lastReadIndex]._id);

			clearTimeout(readTimeoutId);
			stashedReadCount = 0;
		}
	}

	async function setAnchors() {
		//wait for the messages to load
		await tick();
		if (!top_anchor && !bottom_anchor) {
			requestAnimationFrame(setAnchors);
			return;
		}
		//hides scrollbar if not needed
		showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;

		await tick();

		//scroll to the bottom of the (unread)messages
		requestAnimationFrame(async () => {
			const scrollTop = unread_anchor
				? unread_anchor.offsetTop - scrollableContent.clientHeight + 24
				: bottom_anchor.offsetTop;

			scrollableContent.scrollTo({
				top: scrollTop,
				behavior: 'instant'
			});
		});

		//add anchors lazy loading and new messages
		requestAnimationFrame(async () => {
			await tick();
			const lastMessages = Array.from(scrollableContent.querySelectorAll('.message'));

			bottomObserver.observe(bottom_anchor);
			if (scrollBar) topObserver.observe(top_anchor);
			if (unreadCount) {
				lastMessages
					.slice(-unreadIndexesToShow)
					.forEach((message) => readObserver.observe(message));
			}
		});
	}

	$effect(() => {
		messages.length + latestMessages.length;
		if (!showScrollbar && messages.length + latestMessages.length) {
			showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		}
	});

	$effect(() => {
		if (!top_anchor) return;
		topObserver.disconnect();
		topObserver.observe(top_anchor);
	});
	$effect(() => {
		if (!bottom_anchor) return;
		bottomObserver.disconnect();
		bottomObserver.observe(bottom_anchor);
	});

	const TOP_ANCHOR_INDEX = 0;
	//theoreticaly (!!!) this line should work for every number, but plz keep it as
	//multiple of 'INIT_MESSAGES' and 'EXTRA_MESSAGES' in 'api.mjs' on the server🙏
	const INDEXES_PER_STACK = 20; //and also should be smaller than INIT_MESSAGES
	const MAX_STACKS = 5;

	//dynamic loading of messages
	let readStacksLoaded = $state(1);
	let unreadStacksLoaded = $state(0);
	let indexOffset = $state(0);

	let readIndexesToShow = $state(0);
	let unreadIndexesToShow = $state(0);

	let topIndex = $state(0);
	let bottomIndex = $state(0);
	let lastMessages = $state([]) as Message[];

	$effect(() => {
		lastModified;
		untrack(() => {
			console.log();
			if (bottomIndex === messages.length - 1 || bottomIndex === messages.length)
				recalculateIndexes(0);
		});
	});
	$effect(() => {
		receivedNewCount;
		untrack(() => {
			if (totalUnreadCount >= INDEXES_PER_STACK * MAX_STACKS) return;

			readObserver.disconnect(); //disconnect all previous messages
			totalUnreadCount <= unreadStacksLoaded * INDEXES_PER_STACK
				? recalculateIndexes(0)
				: recalculateIndexes(-1);
			//number of unread messages that have not been read (that are in the message array)
			const unreadUnrenderedCount = receivedUnreadCount - (bottomIndex - receivedReadCount);
			const leftUnreadCount = receivedUnreadCount - (totalUnreadCount - unreadCount);

			console.log('unreadUnrenderedCount, leftUnreadCount', unreadUnrenderedCount, leftUnreadCount);
			//checks if some unread messages are rendered
			if (unreadIndexesToShow && unreadUnrenderedCount <= leftUnreadCount) {
				console.log(
					'Math.min(leftUnreadCount - unreadUnrenderedCount, INDEXES_PER_STACK)',
					Math.min(leftUnreadCount - unreadUnrenderedCount, INDEXES_PER_STACK)
				);
				const lastMessagesEl = Array.from(scrollableContent.querySelectorAll('.message'));
				lastMessagesEl
					.slice(-Math.min(leftUnreadCount - unreadUnrenderedCount, INDEXES_PER_STACK))
					.forEach((message) => readObserver.observe(message));
			}
		});
	});

	export async function recalculateIndexes(direction: number): Promise<void> {
		let isFullRange: boolean = false;
		if (direction === 1) {
			isFullRange = receivedReadCount >= readStacksLoaded * INDEXES_PER_STACK + indexOffset;
		} else if (direction === -1) {
			isFullRange =
				bottomIndex - receivedReadCount >= unreadStacksLoaded * INDEXES_PER_STACK - indexOffset;
		}

		if (!isFullRange) null;
		else if (readStacksLoaded + unreadStacksLoaded === MAX_STACKS) {
			if (
				(direction === 1 &&
					unreadStacksLoaded > 0 &&
					receivedReadCount > readStacksLoaded * INDEXES_PER_STACK) ||
				(direction === -1 &&
					readStacksLoaded > 0 &&
					receivedUnreadCount > unreadStacksLoaded * INDEXES_PER_STACK)
			) {
				readStacksLoaded += direction;
				unreadStacksLoaded -= direction;
			} else indexOffset += direction * INDEXES_PER_STACK;
		} else if (direction === 1) readStacksLoaded++;
		else if (direction === -1) unreadStacksLoaded++;

		if (totalUnreadCount - receivedUnreadCount === 0 && lastMessages.length) {
			console.log('Adding latestMessages');
			chat.messages = [...chat.messages, ...chat.latestMessages];
			chat.latestMessages = [];
		}

		readIndexesToShow = Math.min(receivedReadCount, readStacksLoaded * INDEXES_PER_STACK);
		unreadIndexesToShow = Math.min(receivedUnreadCount, unreadStacksLoaded * INDEXES_PER_STACK);

		topIndex = Math.max(receivedReadCount - indexOffset - readIndexesToShow, 0);
		bottomIndex = Math.min(receivedReadCount - indexOffset + unreadIndexesToShow, messages.length);

		lastMessages = [...messages.slice(topIndex, bottomIndex)];
		await tick();
		requestAnimationFrame(() => null);
	}

	onMount(async () => {
		if (unreadCount) await recalculateIndexes(-1);
		firstUnreadId = messages[receivedReadCount - 1]._id;
		setAnchors();
	});

	export function destroy() {
		if (stashedReadCount) {
			clearInterval(readTimeoutId);
			const lastReadIndex =
				messages.length +
				latestMessages.length -
				receivedUnreadCount +
				(totalUnreadCount - unreadCount) -
				1;
			if (lastReadIndex < messages.length + latestMessages.length)
				sendReadUpdate(chat._id, messages[lastReadIndex]._id);
		}
		chat.receivedUnreadCount -= totalUnreadCount - unreadCount;

		topObserver.disconnect();
		bottomObserver.disconnect();
		readObserver.disconnect();
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

		{#each lastMessages as { _id, from, text, sendTime, sending }, i (_id)}
			{#if i === TOP_ANCHOR_INDEX && receivedReadCount >= INDEXES_PER_STACK}
				<div bind:this={top_anchor} class="anchor"></div>
			{/if}
			<div
				class="message"
				class:sent={from === getCookie('uid')}
				class:received={from !== getCookie('uid')}
				class:sending
				id={_id}
			>
				<p class="text">{text}</p>
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
