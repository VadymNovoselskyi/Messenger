<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import MessageField from '$lib/components/MessageField.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import { getExtraMessages } from '$lib/api.svelte';
	import { formatISODate, getCookie } from '$lib/utils';
	import type { Chat, Message } from '$lib/types';

	let {
		chat,
		submitFn
	}: { chat: Chat; submitFn: (event: SubmitEvent) => void } = $props();
	let messages = $derived(chat.messages);

	let observer: IntersectionObserver;
	let scrollableContent = $state() as HTMLElement;
	let top_anchor = $state() as HTMLElement;
	let bottom_anchor = $state() as HTMLElement;
	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state<boolean>();

	async function handleIntersection(): Promise<void> {
		//saves the current height of the scrollable content, to keep the scroll position later
		const prevHeight = scrollableContent.scrollHeight - scrollableContent.scrollTop;

		//check if anchor was reached by drag
		const isDragging = scrollBar.isDraggingOn();
		if (isDragging) scrollBar.onMouseUp();

		//load more messages
		stacksLoaded++;
		console.log(indexesToShow, messages?.length);
		if(indexesToShow >= (messages?.length ?? 0)) getExtraMessages(chat._id, messages.length);

		await tick();
		requestAnimationFrame(async () => {
			await tick();
			observer.disconnect();
			observer.observe(top_anchor);
		});

		scrollableContent.scrollTo({
			top: scrollableContent.scrollHeight - prevHeight,
			behavior: 'instant'
		});

		if (isDragging) {
			await tick();
			scrollBar.onMouseDown();
		}
	}

	async function setAnchors() {
		//wait for the messages to load
		await tick();
		if (!bottom_anchor) {
			requestAnimationFrame(setAnchors);
			return;
		}
		//hides scrollbar if not needed
		showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;

		//scroll to the bottom of the messages
		scrollableContent.scrollTop = 0;
		requestAnimationFrame(() => {
			scrollableContent.scrollTo({
				top: bottom_anchor.offsetTop,
				behavior: 'instant'
			});
		});

		//add top_anchor observer for lazy loading
		requestAnimationFrame(async () => {
			await tick();
			if (scrollBar) observer.observe(top_anchor);
		});
	}

	$effect(() => {
		chat; //needed to cause the effect
		setAnchors();
	});
	$effect(()=> {
		messages.length;
		if(!showScrollbar && messages.length) {
			showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
		}
	});

	onMount(() => {
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						handleIntersection();
					}
				});
			},
			{ threshold: 0.9 }
		);
	});

	const TOP_ANCHOR_INDEX = 6; 

	//THIS SHOULD BE A MULTIPLE OF THE INIT_MESSAGES ON THE SERVER IN api.mjs
	//OTHERWISE THE MESSAGES WILL JUMP TO THE LOWEST MULTIPLE
	const INDEXES_PER_STACK = 20;

	//dynamic loading of messages
	let stacksLoaded = $state(1);
	let indexesToShow = $derived(Math.min(messages.length, stacksLoaded * INDEXES_PER_STACK));
	let lastMessages = $derived(messages.slice(-indexesToShow));
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
		{#if lastMessages}
			{#each lastMessages as message, i}
				{#if i === TOP_ANCHOR_INDEX}
					<div bind:this={top_anchor} class="anchor"></div>
				{/if}
				<div
					class="message"
					class:sent={message.from === getCookie('uid')}
					class:received={message.from !== getCookie('uid')}
					class:sending={message.isReceived === false}
				>
					<p class="text">{message.text}</p>
					<p class="sendTime">{formatISODate(message.sendTime)}</p>
				</div>
			{/each}
			<div bind:this={bottom_anchor} id="bottom-anchor" class="anchor"></div>
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

		position: relative;
		height: 94vh;
	}

	#messages {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		grid-auto-rows: max-content;

		padding: 0 0.8rem;
		background-color: #3a506b;

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
			grid-column: 1 / -1;
			height: 1px;
			width: 100%;
		}

		#bottom-anchor {
			grid-row: auto;
			overflow-anchor: auto;
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
