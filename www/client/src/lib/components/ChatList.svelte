<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { addChat } from '$lib/api.svelte';
	import { formatISODate, getCookie } from '$lib/utils';
	import type { Chat, User } from '$lib/types';

	let { chats = $bindable() }: { chats: Chat[] } = $props();
	let showAddChat = $state(false);
	let usernameInput: HTMLInputElement;

	let scrollableContent: HTMLElement;
	let scrollableThumb: HTMLElement;
	let isDragging = false;
	let startY: number;
	let startScrollTop: number;

	const updateThumbPosition = () => {
		const contentHeight = scrollableContent.scrollHeight;
		const visibleHeight = scrollableContent.clientHeight;
		const scrollTop = scrollableContent.scrollTop;

		const thumbHeight = (visibleHeight / contentHeight) * visibleHeight;
		const thumbPosition = (scrollTop / contentHeight) * visibleHeight + scrollTop;

		scrollableThumb.style.height = `${thumbHeight}px`;
		scrollableThumb.style.transform = `translateY(${thumbPosition}px)`;
	};

	function onMouseDown(event: MouseEvent) {
		isDragging = true;
		startY = event.clientY;
		startScrollTop = scrollableContent.scrollTop;
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	function onMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		const deltaY = event.clientY - startY;
		const contentHeight = scrollableContent.scrollHeight;
		const visibleHeight = scrollableContent.clientHeight;
		const thumbHeight = Math.max((visibleHeight / contentHeight) * visibleHeight, 20);
		const scrollRatio = (contentHeight - visibleHeight) / (visibleHeight - thumbHeight);
		scrollableContent.scrollTop = startScrollTop + deltaY * scrollRatio;
	}

	function onMouseUp() {
		isDragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	onMount(() => {
		window.addEventListener('resize', updateThumbPosition);
		updateThumbPosition();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id="chats"
	bind:this={scrollableContent}
	onscroll={updateThumbPosition}
	onmousedown={onMouseDown}
>
	<h1 id="chats-list-title">Chats</h1>

	<div class="scrollable-thumb-container">
		<div class="scrollable-thumb" bind:this={scrollableThumb}></div>
	</div>

	{#each chats as chat}
		<a href="{$page.url.origin}/{chat._id}" class="chat">
			<img
				src={''}
				alt={chat.users.find((user: User) => user.uid !== getCookie('uid'))!.username}
				class="profile-picture"
			/>
			<h3 class="chat-name">
				{chat.users.find((user: User) => user.uid !== getCookie('uid'))!.username}
			</h3>
			<p class="chat-message" class:system-message={!chat.messages.length}>
				{chat.messages[chat.messages.length - 1]?.text ?? 'No messages'}
			</p>
			<p class="send-date">{formatISODate(chat.lastModified)}</p>
		</a>
	{/each}

	<!-- svelte-ignore a11y_consider_explicit_label -->
</div>
<button
	id="add-chat"
	onclick={async () => {
		showAddChat = !showAddChat;
		await tick();
		usernameInput.focus();
	}}
>
	<i>+</i>
</button>

{#if showAddChat}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="popup-overlay" onclick={() => (showAddChat = false)}></div>
	<div class="popup-menu" class:active={showAddChat}>
		<button class="close-popup" onclick={() => (showAddChat = false)}>x</button>
		<form
			onsubmit={(event: SubmitEvent) => {
				addChat(event);
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
{/if}

<style lang="scss">
	#chats {
		position: relative;
		overflow: scroll;
		padding: 0.2rem 0.3rem;

		#chats-list-title {
			padding: 1rem 0;
			justify-self: center;
		}

		.scrollable-thumb-container {
			position: absolute;
			top: 0;
			right: 0rem;
			width: 0.3rem;
			height: 100%;
			z-index: 5;

			.scrollable-thumb {
				position: absolute;
				width: 100%;
				background-color: var(--scrollbar-color, #888);
				border-radius: 8px;
				opacity: 0;
				transition: opacity 0.1s ease-in-out;
			}
		}

		&:hover .scrollable-thumb {
			opacity: 1;
		}

		.chat {
			display: grid;
			grid-template-columns: auto 1fr;
			grid-template-rows: auto 4rem auto;
			grid-gap: 0 1rem;
			align-items: center;
			padding: 0.4rem;
			border: 1px solid var(--secondary-bg-color);
			text-decoration: none;

			.profile-picture {
				grid-column: 1;
				grid-row: span 2;
				width: 64px;
				height: 64px;
			}

			.chat-name {
				grid-column: 2;
				grid-row: 1;

				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.chat-message {
				grid-column: 2;
				grid-row: 2;

				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.system-message {
				color: #0065e1;
			}

			.send-date {
				grid-column: span 2;
				grid-row: 3;

				justify-self: end;
			}

			&:hover {
				cursor: pointer;
				background-color: var(--primary-hover-bg-color);
				color: var(--primary-hover-text-color);
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

	#add-chat {
		position: sticky;
		margin-top: calc(100% + 5.8rem);
		margin-left: calc(100% - 3rem);
		transform: translate(-0.2rem, calc(11.8rem - 94vh));

		background-color: #0065e1;
		border: none;
		cursor: pointer;
		border-radius: 0.6rem;
		z-index: 10	;

		i {
			color: var(--primary-bg-color);
			font-weight: 900;
			font-size: 2.4rem;
		}
	}

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
