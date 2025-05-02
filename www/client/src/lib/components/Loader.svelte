<script lang="ts">
	let { promise }: { promise?: Promise<any> } = $props();
</script>

{#if promise}
	{#await promise}
		<div class="loader"></div>
	{:catch error}
		<p class="error-message">{error.message}</p>
	{/await}
{:else}
	<div class="loader"></div>
{/if}

<style lang="scss">
	.loader {
		justify-self: center;

		width: 3rem;
		padding: 0.4rem;
		margin: 0.6rem 0;
		background: var(--primary-text-color);

		aspect-ratio: 1;
		border-radius: 50%;
		mask:
			conic-gradient(#0000, #000) subtract,
			conic-gradient(#000 0 0) content-box;
		animation: load 1s linear infinite;

		@keyframes load {
			to {
				rotate: 1turn;
			}
		}
	}

	.error-message {
		justify-self: center;

		background-color: rgba(255, 0, 0, 0.1);
		color: #ff0000;
		border: 1px solid #ff0000;
		border-radius: 8px;

		margin-top: 0.4rem;
		padding: 1rem 2rem;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);

		font-size: 1.4rem;
		font-weight: 800;
	}
</style>
