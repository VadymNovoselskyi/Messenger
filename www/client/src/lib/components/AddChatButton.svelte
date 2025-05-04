<script lang="ts">
	import { createChat } from '$lib/api/RequestService';

	let usernameInput = $state() as HTMLInputElement;
	let { showAddChat = $bindable() }: { showAddChat: boolean } = $props();

    $effect(() => {
        if(showAddChat && usernameInput) usernameInput.focus();
    })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="popup-overlay" onclick={() => (showAddChat = false)}></div>
<div class="popup-menu" class:active={showAddChat}>
	<button class="close-popup" onclick={() => (showAddChat = false)}>x</button>
	<form
		onsubmit={(event: SubmitEvent) => {
			createChat(event);
			showAddChat = false;
		}}
	>
		<label for="name">Username:</label>
		<input
			bind:this={usernameInput}
			type="text"
			id="username"
			name="username"
			placeholder="Username you want to add"
		/>
		<button type="submit">Add</button>
	</form>
</div>

<style lang="scss">
	.popup-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 9;
	}

	.popup-menu {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background-color: var(--primary-bg-color);
		border: 1px solid #dddddd;
		border-radius: 4px;
		z-index: 10;
		padding: 1rem;
		min-width: 24rem;
		width: 30vw;

		form {
			display: grid;
			font-size: 1.2rem;

			label {
				display: block;
				margin-bottom: 0.4rem;
				font-weight: bold;
			}

			input {
				font-size: 1rem;
				padding: 0.6rem 0.4rem;
				border-radius: 0.8rem;
				border: 1px solid transparent;
			}

			button[type='submit'] {
				font-size: 1.2rem;
				background-color: #007bff;
				color: var(--secondary-text-color);
				margin-top: 1.4rem;
				padding: 0.6rem 1rem;
				border-radius: 4px;
				border: none;
				cursor: pointer;

				&:hover {
					background-color: #0860bf;
				}
			}
		}

		.close-popup {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			background: none;
			border: none;
			color: #888;
			font-size: 1.2rem;
			font-weight: bold;
			transition: color 0.4s ease;
			cursor: pointer;
		}

		.close-popup:hover {
			color: #ff0000;
		}
	}
</style>
