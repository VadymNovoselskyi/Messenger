<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import { PaginationService } from '$lib/services/PaginationService.svelte';
	import { getMessagesDbService } from '$lib/indexedDB/MessagesDbService.svelte';

	import { sendReadUpdate } from '$lib/api/RequestService';
	import { formatISODate } from '$lib/utils/utils.svelte';
	import { getMyChatMetadata, getOtherUserChatMetadata } from '$lib/utils/chatMetadataUtils.svelte';

	import type { Action } from 'svelte/action';
	import type { StoredMessage, StoredChat } from '$lib/types/dataTypes';
	import { getCookie } from '$lib/utils/cookieUtils';

	const {
		chat,
		messages,
		scrollBar
	}: { chat: StoredChat; messages: StoredMessage[]; scrollBar: Scrollbar } = $props();
	const { users, lastSequence } = $derived(chat);

	const MAX_PAGES = 5;
	const PAGE_SIZE = 20;
	const paginationService = new PaginationService<StoredMessage>(
		messages,
		MAX_PAGES,
		PAGE_SIZE,
		async (direction, elements) => {
			let low: number;
			let high: number;
			if (direction === 'UP') {
				low = Math.max(elements[0].sequence - PAGE_SIZE, 0);
				high = Math.min(low + PAGE_SIZE - 1, elements[0].sequence - 1);
			} else if (direction === 'DOWN') {
				low = Math.max(elements.at(-1)!.sequence + 1, 0);
				high = Math.min(low + PAGE_SIZE - 1, lastSequence);
			} else return [];

			if (low > high) return [];
			return (await getMessagesDbService()).getMessagesByIndex(chat._id, low, high);
		},
		// svelte-ignore state_referenced_locally
		lastSequence
	);

	$effect(() => {
		paginationService.totalLength = lastSequence;
	});

	// svelte-ignore state_referenced_locally
	let startingLastReadSequenceMe = $state(getMyChatMetadata(chat._id).lastReadSequence);
	let lastReadSequenceMe = $derived(getMyChatMetadata(chat._id).lastReadSequence);
	let lastReadSequenceOther = $derived(getOtherUserChatMetadata(chat._id).lastReadSequence);
	let unreadCount = $derived(lastSequence - lastReadSequenceMe);

	const SCROLL_ADJUSTMENT = 24;
	let wrapper = $state() as HTMLElement;

	let topAnchor = $state() as HTMLElement;
	let unreadAnchor = $state() as HTMLElement;
	let bottomAnchor = $state() as HTMLElement;

	const MAX_READ_TIMEOUT = 1000;
	const MAX_STASHED_COUNT = 3;
	let stashedReadCount = $state(0);
	let lastTimeoutTime = $state(0);
	let readTimeoutId = $state<number>();

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

	const readObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				readObserver.unobserve(entry.target);
				entry.target.dispatchEvent(
					new CustomEvent<IntersectionObserverEntry>('intersect', { detail: entry })
				);
			}
		},
		{ threshold: 0.4 }
	);
	const readIntersectionAction: Action<Element, boolean> = (element, enabled) => {
		if (!enabled) return;
		readObserver.observe(element);
		return {
			update(newEnabled: boolean) {
				if (newEnabled) readObserver.observe(element);
				else readObserver.unobserve(element);
			},
			destroy() {
				readObserver.unobserve(element);
			}
		};
	};

	async function handleTopIntersection() {
		const prevTopEl = paginationService.paginatedElements[0];
		if (!prevTopEl) return;
		const prevTopId = prevTopEl._id;
		const prevTopSequence = prevTopEl.sequence;

		if (prevTopSequence <= 1) return;

		const wasDragging = scrollBar && scrollBar.isDraggingOn();
		if (wasDragging) scrollBar.onMouseUp();

		await paginationService.changePage('UP');
		await tick();

		const prevTopElement = document.getElementById(prevTopId);
		if (prevTopElement) {
			prevTopElement.scrollIntoView({ behavior: 'instant', block: 'start' });
			wrapper.scrollTop -= SCROLL_ADJUSTMENT;
		}

		if (wasDragging) scrollBar.onMouseDown();
	}

	async function handleBottomIntersection() {
		const prevBottomEl = paginationService.paginatedElements.at(-1);
		if (!prevBottomEl) return;
		const prevBottomId = prevBottomEl._id;
		const prevBottomSequence = prevBottomEl.sequence;

		if (prevBottomSequence === lastSequence) return;

		const wasDragging = scrollBar && scrollBar.isDraggingOn();
		if (wasDragging) scrollBar.onMouseUp();

		await paginationService.changePage('DOWN');
		await tick();

		const prevBottomElement = document.getElementById(prevBottomId);
		if (prevBottomElement) {
			prevBottomElement.scrollIntoView({ behavior: 'instant', block: 'end' });
			wrapper.scrollTop += SCROLL_ADJUSTMENT;
		}

		if (wasDragging) scrollBar.onMouseDown();
	}

	function handleMessageRead(event: CustomEvent<IntersectionObserverEntry>) {
		const lastReadSequence = messages.find(
			(message) => message._id === event.detail.target.id
		)?.sequence;
		if (!lastReadSequence) return;
		getMyChatMetadata(chat._id).lastReadSequence = lastReadSequence;

		if (stashedReadCount >= MAX_STASHED_COUNT || lastReadSequence === lastSequence) {
			clearTimeout(readTimeoutId);
			stashedReadCount = 0;
			lastTimeoutTime = 0;
			sendReadUpdate(chat._id, lastReadSequence);
			return;
		}
		if (!lastTimeoutTime) {
			setReadTimeout(lastReadSequence);
			return;
		}
		clearTimeout(readTimeoutId);
		setReadTimeout(lastReadSequence);
		return;
	}
	function setReadTimeout(lastReadSequence: number) {
		const timeoutOffset = lastTimeoutTime ? Date.now() - lastTimeoutTime : 0;
		readTimeoutId = window.setTimeout(() => {
			stashedReadCount = 0;
			lastTimeoutTime = 0;
			sendReadUpdate(chat._id, lastReadSequence);
		}, MAX_READ_TIMEOUT - timeoutOffset);
		stashedReadCount++;
		lastTimeoutTime = Date.now();
	}

	onMount(setAnchors);

	$effect(() => {
		if (!unreadCount && lastSequence) startingLastReadSequenceMe = lastSequence;
	});

	async function setAnchors() {
		await tick();
		if (!topAnchor || !bottomAnchor || (!unreadAnchor && unreadCount)) {
			requestAnimationFrame(setAnchors);
			return;
		}
		console.log(wrapper.clientHeight, bottomAnchor.offsetTop, wrapper.scrollHeight);
		if (unreadAnchor) unreadAnchor.scrollIntoView({ behavior: 'instant', block: 'start' });
		if (bottomAnchor) bottomAnchor.scrollIntoView({ behavior: 'instant', block: 'end' });

		topObserver.observe(topAnchor);
		bottomObserver.observe(bottomAnchor);
	}

	function getMessageReadStatus(sequence: number) {
		return lastReadSequenceOther >= sequence && sequence >= 0 ? '✓✓' : '✓';
	}
</script>

<div id="wrapper" bind:this={wrapper}>
	<div bind:this={topAnchor} class="anchor"></div>
	{#each paginationService.paginatedElements as { _id, from, plaintext, sequence, sendTime, isPending } (_id)}
		<!-- Dont mind the error below, just a TypeScript issue (oninspect) -->
		<div
			class="message"
			class:sent={from === getCookie('userId')}
			class:received={from !== getCookie('userId')}
			class:pending={isPending}
			use:readIntersectionAction={sequence > lastReadSequenceMe && !!unreadCount}
			onintersect={handleMessageRead}
			id={_id}
		>
			<p class="text">{plaintext}</p>
			<p class="sendTime">
				{formatISODate(sendTime)}
				{from === getCookie('userId') ? getMessageReadStatus(sequence) : ''}
			</p>
		</div>
		{#if sequence === startingLastReadSequenceMe && sequence !== lastSequence}
			<div bind:this={unreadAnchor} id="unread-anchor" class="anchor">Unread Messages</div>
		{/if}
	{/each}
	<div bind:this={bottomAnchor} id="bottom-anchor" class="anchor"></div>
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		grid-auto-rows: max-content;

		padding: 0 0.8rem;
	}

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

		&.pending {
			background-color: #83c5c08f;
			opacity: 0.8;
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
	}
</style>
