<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	import { getChats, sendKeys } from '$lib/api.svelte';
	import { generateKeys, getCookie } from '$lib/utils';

	import { memory } from '$lib/stores/memory.svelte';
	import ChatList from '$lib/components/ChatList.svelte';
	import { SignalProtocolStore } from '$lib/stores/SignalProtocolStore';
	import type { PreKeyBundle } from '$lib/signalTypes';

	onMount(async () => {
		if (!getCookie('userId') || !getCookie('token')) {
			goto('/login');
			return;
		}
		if (browser && !memory.chats.length) getChats();

		const store = new SignalProtocolStore();
		const isFilled = await store.check();
		if (!isFilled) {
			const keys = await generateKeys();
			console.log(keys);

			const result = await sendKeys(keys)
			console.log(`Result: ${result}`)
		} else {
			const registrationId = await store.get('registrationId');
			console.log(registrationId);
		}
	});
</script>

<svelte:head>
	<title>Chats</title>
</svelte:head>

<div id="wrapper">
	<section id="chats-list">
		<ChatList bind:chats={memory.chats} />
	</section>

	<section id="chat-display"></section>
</div>

<style lang="scss">
	#wrapper {
		display: grid;
		grid-template-columns: minmax(14rem, 3fr) 8fr;
		height: 94vh;

		#chat-display {
			background-color: #3a506b;
		}
	}
</style>
