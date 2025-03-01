<script lang="ts">
	import { page } from '$app/state';

	function defaultFN(event: Event) {
		event.preventDefault();
	}

	let textInput: HTMLInputElement;

	$effect(() => {
		const { cid } = page.params;

		requestAnimationFrame(() => {
			if (textInput) {
				textInput.value = '';
				textInput.focus();
			}
		});
	});

	let { submitFn = defaultFN }: { submitFn: (event: SubmitEvent) => void } = $props();
</script>

<form action="" onsubmit={submitFn}>
	<input
		bind:this={textInput}
		id="message-input"
		type="text"
		name="message"
		placeholder="Type your text here"
		autocomplete="off"
		maxlength="1000"
	/>
	<button id="send-icon" aria-label="Send message">
		<img src="/paper-plane.svg" alt="Send" />
	</button>
</form>

<style lang="scss">
	form {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0.4rem;
		background-color: #3a506b;

		#message-input {
			padding: 6px;
			margin-right: 10px;
			border: none;
			font-size: 17px;
			border-radius: 4px;

			&:focus {
				outline: none;
			}
		}

		#send-icon {
			padding: 0.4rem 0.8rem;
			background-color: white;
			border: none;
			cursor: pointer;
			border-radius: 4px;

			img {
				width: 1rem;
				height: 1rem;
			}
		}
	}
</style>
