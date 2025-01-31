<script lang="ts">
	import { formatISODate, getCookie } from '$lib/utils';
	import type { Message } from '$lib/types';

	let { messages }: { messages: Message[] | null } = $props();
</script>

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

<style lang="scss">
	.message {
		overflow-wrap: break-word;
		overflow-anchor: none;
		padding: 0.6rem;
		border-radius: 1rem;
		margin: 1rem 0;

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
</style>
