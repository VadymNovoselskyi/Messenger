<script lang="ts">
	import { tick } from 'svelte';
	import MessageField from '$lib/components/MessageField.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';
	import { formatISODate, getCookie } from '$lib/utils';
	import type { Message } from '$lib/types';

	let { messages, submitFn }: { messages: Message[] | null, submitFn: (event: Event) => void } = $props();

	let scrollableContent = $state() as HTMLElement;
	let scrollBar = $state() as Scrollbar;

	export async function scrollToBottom() {
		await tick();
		scrollableContent.scrollTop = scrollableContent.scrollHeight;
	}
</script>

<div id="message-list">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_mouse_events_have_key_events -->
	<div
		id="messages"
		bind:this={scrollableContent}
		onmouseover={scrollBar.show}
		onmouseleave={scrollBar.hide}
		onscroll={scrollBar.updateThumbPosition}
		onmousedown={scrollBar.onMouseDown}
	>
		<Scrollbar bind:this={scrollBar} {scrollableContent} />
		{#if messages}
			{#each messages as message}
				<div
					class="message"
					class:sent={message.from === getCookie('uid')}
					class:received={message.from !== getCookie('uid')}
				>
					<h3 class="text">{message.text}</h3>
					<p class="sendTime">{formatISODate(message.sendTime)}</p>
				</div>
			{/each}
			<div id="anchor"></div>
		{:else}
			<div class="error-container">
				<div id="error_message">
					<p>Fetching is in progress!</p>
				</div>
			</div>
		{/if}
	</div>
	<MessageField {submitFn} />
</div>

<style lang="scss">
	#message-list {
		display: grid;
		grid-template-rows: 1fr auto;

		height: 94vh;
	}

	#messages {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		grid-auto-rows: max-content;

		padding: 0 0.6rem;
		background-color: #3a506b;

		position: relative;
		overflow-y: scroll;

		.message {
			overflow-wrap: break-word;
			overflow-anchor: none;
			padding: 0.6rem;
			border-radius: 1rem;
			margin: 0.8rem 0;

			&.received {
				grid-column: 1/7;
				background-color: #edf6f9;
			}

			&.sent {
				grid-column: 5/11;
				background-color: #83c5be;
			}

			.sendTime {
				justify-self: end;
			}
		}

		#anchor {
			grid-column: 1 / -1;
			grid-row: auto;

			overflow-anchor: auto;
			height: 1px;
			width: 100%;
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
