<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import MessageField from '$lib/components/MessageField.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import { formatISODate, getCookie } from '$lib/utils';
	import type { Message } from '$lib/types';

	let {
		messages,
		submitFn
	}: { messages: Message[] | null; submitFn: (event: SubmitEvent) => void } = $props();

	let scrollableContent = $state() as HTMLElement;
	let top_anchor = $state() as HTMLElement;
	let bottom_anchor = $state() as HTMLElement;
	let scrollBar = $state() as Scrollbar;
	let showScrollbar = $state<boolean>();

	$effect(() => {
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

		const { cid } = page.params; //needed to cause the effect
		setAnchors();
	});

	$effect(()=> {
		messages?.length;
		if(messages?.length && !showScrollbar) showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;
	});

	let observer: IntersectionObserver;
	onMount(async () => {
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach(async (entry) => {
					if (entry.isIntersecting) {
						//saves the current height of the scrollable content, to keep the scroll position later
						const prevHeight = scrollableContent.scrollHeight - scrollableContent.scrollTop;

						//check if anchor was reached by drag
						const isDragging = scrollBar.isDraggingOn();
						if (isDragging) scrollBar.onMouseUp();

						//load more messages
						stacksLoaded++;

						await tick();
						scrollableContent.scrollTo({
							top: scrollableContent.scrollHeight - prevHeight,
							behavior: 'instant'
						});

						if (isDragging) {
							await tick();
							scrollBar.onMouseDown();
						}
					}
				});
			},
			{ threshold: 0.1 }
		);
	});

	const indexesPerStack = 20;
	//dynamic loading of messages
	let stacksLoaded = $state(0);
	let indexesToShow = $derived(
		(messages?.length ?? 0) >= (stacksLoaded + 1) * indexesPerStack
			? (stacksLoaded + 1) * indexesPerStack
			: messages?.length || 0
	);
	let lastMessages = $derived(messages?.slice(-indexesToShow));
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
				{#if i === 4}
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
