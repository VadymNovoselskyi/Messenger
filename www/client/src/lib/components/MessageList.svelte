<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import MessageField from '$lib/components/MessageField.svelte';
	import Loader from '$lib/components/Loader.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import { getExtraMessages, getExtraNewMessages } from '$lib/api.svelte';
	import { formatISODate, getCookie, createObserver } from '$lib/utils';
	import type { Chat, Message } from '$lib/types';

	let { chat, submitFn }: { chat: Chat; submitFn: (event: SubmitEvent) => void } = $props();
	let { messages, unreadMessagesCount, showingUnreadMessagesCount, extraMessagesCount } = $derived(chat);
	const startingUnreadMessagesCount = chat.unreadMessagesCount;
	const receivedUnreadMessagesCount = chat.showingUnreadMessagesCount;

	let extraMessagesPromise: Promise<void> = $state(Promise.resolve());
	let unreadMessagesPromise: Promise<void> = $state(Promise.resolve());

	let scrollableContent = $state() as HTMLElement;
	let top_anchor = $state() as HTMLElement;
	let unread_anchor = $state() as HTMLElement;
	let bottom_anchor = $state() as HTMLElement;

	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state<boolean>();

	let topObserver = createObserver(handleTopIntersection, 0.5);
	let bottomObserver = createObserver(handleBottomIntersection, 0.5);
	let readObserver = createObserver((entry: IntersectionObserverEntry) => {
		readObserver.unobserve(entry.target);
		handleMessageRead();
	}, 0.5);

	async function handleTopIntersection(): Promise<void> {
		setTimeout(async () => {

			//saves the current height of the scrollable content, to keep the scroll position later
			let anchorId = lastMessages[0]._id;
		
			//check if anchor was reached by drag
			let isDragging = false;
			if (scrollBar) isDragging = scrollBar.isDraggingOn();
			if (isDragging) scrollBar.onMouseUp();
		
			//load more messages
			console.log(readIndexesToShow, unreadIndexesToShow, messages.length, 'top');
			if (readIndexesToShow >= messages.length - receivedUnreadMessagesCount) {
				extraMessagesPromise = getExtraMessages(
					chat._id,
					messages.length - receivedUnreadMessagesCount + startingUnreadMessagesCount
				);
				await extraMessagesPromise;
			}
		
			if (readStacksLoaded + unreadStacksLoaded === MAX_STACKS) {
				if (unreadStacksLoaded > 0) {
					unreadStacksLoaded--;
					readStacksLoaded++;
				} else indexOffset += INDEXES_PER_STACK;
			} else readStacksLoaded++;
		
			await tick();
			requestAnimationFrame(async () => {
				await tick();
				topObserver.disconnect();
				topObserver.observe(top_anchor);
			});
		
			const anchorElelemnt = document.getElementById(anchorId);
			if (anchorElelemnt) {
				anchorElelemnt.scrollIntoView({ behavior: 'instant', block: 'start' });
				scrollableContent.scrollTop -= 15; //adjust for margin between messages
			}
		
			if (isDragging) {
				await tick();
				scrollBar.onMouseDown();
			}
		}, 2000);
	}
	
	async function handleBottomIntersection(): Promise<void> {
		//check if anchor was reached by drag
		let isDragging = false;
		if (scrollBar) isDragging = scrollBar.isDraggingOn();
		if (isDragging) scrollBar.onMouseUp();

		if (unreadMessagesCount > 0 && unreadIndexesToShow >= receivedUnreadMessagesCount) {
			//saves the current height of the scrollable content, to keep the scroll position later
			let anchorId = lastMessages[lastMessages.length - 1]._id;

			unreadMessagesPromise = getExtraNewMessages(chat._id, unreadMessagesCount);
			await unreadMessagesPromise;

			if (readStacksLoaded + unreadStacksLoaded === MAX_STACKS) {
				if (readStacksLoaded > 0) {
					readStacksLoaded--;
					unreadStacksLoaded++;
				} else indexOffset -= INDEXES_PER_STACK;
			} else unreadStacksLoaded++;

			await tick();

			const anchorElelemnt = document.getElementById(anchorId);
			if (anchorElelemnt) {
				anchorElelemnt.scrollIntoView({ behavior: 'instant', block: 'start' });
				scrollableContent.scrollTop += 15; //adjust for margin between messages
			}
		}

		if (isDragging) {
			await tick();
			scrollBar.onMouseDown();
		}
	}

	async function handleMessageRead() {
		chat.unreadMessagesCount--;
		chat.showingUnreadMessagesCount--;
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

		//scroll to the bottom of the messages
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
			if (unreadMessagesCount) {
				lastMessages
					.slice(-unreadIndexesToShow)
					.forEach((message) => readObserver.observe(message));
			}
		});
	}

	$effect(() => {
		messages.length;
		if (!showScrollbar && messages.length) {
			showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		}
	});

	const TOP_ANCHOR_INDEX = 0;
	//THIS SHOULD BE A MULTIPLE OF INIT_MESSAGES ON THE SERVER IN api.mjs
	//OTHERWISE THE MESSAGES WILL JUMP TO THE LOWEST MULTIPLE
	const INDEXES_PER_STACK = 20;
	const MAX_STACKS = 5;

	//dynamic loading of messages
	let readStacksLoaded = $state(1);
	let unreadStacksLoaded = $state(0);
	let indexOffset = $state(0);

	let readIndexesToShow = $state(0);
	let unreadIndexesToShow = $state(0);
	let lastMessages = $state([] as Message[]);
	$effect(() => {
		readIndexesToShow = Math.min(
			messages.length - receivedUnreadMessagesCount,
			readStacksLoaded * INDEXES_PER_STACK
		);
		unreadIndexesToShow = Math.min(
			receivedUnreadMessagesCount,
			unreadStacksLoaded * INDEXES_PER_STACK
		);

		lastMessages = [
			...messages.slice(
				messages.length - receivedUnreadMessagesCount + indexOffset - readIndexesToShow,
				messages.length - receivedUnreadMessagesCount + indexOffset
			),
			...messages.slice(
				messages.length - receivedUnreadMessagesCount - indexOffset,
				messages.length - receivedUnreadMessagesCount - indexOffset + unreadIndexesToShow
			)
		];

		console.log(
			'readIndexesToShow, unreadIndexesToShow, messages.length',
			readIndexesToShow,
			unreadIndexesToShow,
			messages.length
		);
		console.log(
			'starting read, finishing read',
			messages.length - receivedUnreadMessagesCount + indexOffset - readIndexesToShow,
			messages.length - receivedUnreadMessagesCount + indexOffset
		);
		console.log(
			'starting unread, finishing unread',
			messages.length - receivedUnreadMessagesCount - indexOffset,
			messages.length - receivedUnreadMessagesCount - indexOffset + unreadIndexesToShow
		);
	});

	onMount(() => {
		setAnchors();
		if (unreadMessagesCount) unreadStacksLoaded++;
	});
	onDestroy(() => {
		topObserver.disconnect();
		bottomObserver.disconnect();
		readObserver.disconnect();
	});
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

		{#if lastMessages}
			{#each lastMessages as message, i (message._id)}
				{#if i === TOP_ANCHOR_INDEX}
					<div bind:this={top_anchor} class="anchor"></div>
				{/if}
				<div
					class="message"
					class:sent={message.from === getCookie('uid')}
					class:received={message.from !== getCookie('uid')}
					class:sending={message.isReceived === false}
					id={message._id}
				>
					<p class="text">{message.text}</p>
					<p class="sendTime">{formatISODate(message.sendTime)}</p>
				</div>
				{#if i === readIndexesToShow - 1 && i !== lastMessages.length - 1}
					<div bind:this={unread_anchor} id="unread-anchor" class="anchor">Unread Messages</div>
				{/if}
			{/each}
			<div bind:this={bottom_anchor} id="bottom-anchor" class="anchor"></div>

			<Loader promise={unreadMessagesPromise} />
		{:else}
			<div class="error-container">
				<div id="error_message">
					<p>Fetching is in progress!</p>
				</div>
			</div>
		{/if}
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

		.error-container {
			grid-column: span 10;
			position: relative;
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100vh;
			width: 100%;

			#error_message {
				background-color: rgba(255, 0, 0, 0.1);
				color: #ff0000;
				border: 1px solid #ff0000;
				border-radius: 8px;
				padding: 20px 40px;
				box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
				font-family: Arial, sans-serif;
				font-size: 18px;
				text-align: center;
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
