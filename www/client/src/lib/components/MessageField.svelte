<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';

	function defaultFN(event: Event) {
		event.preventDefault();
	}

	let textInput: HTMLInputElement;

	$effect(() => {
		const { cid } = $page.params;

		requestAnimationFrame(() => {
			if (textInput) {
				textInput.value = '';
				textInput.focus();
			}
		});
	});

	let { submitFn = defaultFN } = $props();
</script>

<svelte:head>
	<script src="https://kit.fontawesome.com/00ab35ae35.js" crossorigin="anonymous"></script>
</svelte:head>

<form action="" onsubmit={submitFn}>
	<input
		bind:this={textInput}
		id="message-input"
		type="text"
		name="message"
		placeholder="Type your text here"
		autocomplete="off"
	/>
	<button id="send-icon">
		<i class="fa-solid fa-paper-plane"></i>
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
		}

		#send-icon {
			padding: 0.5rem 0.8rem;
			background-color: white;
			border: none;
			cursor: pointer;
			border-radius: 4px;
		}
	}
</style>
