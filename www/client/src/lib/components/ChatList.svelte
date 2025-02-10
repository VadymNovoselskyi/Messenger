<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { memory } from '$lib/stores/memory.svelte';
	import { addChat } from '$lib/api.svelte';
	import Scrollbar from '$lib/components/Scrollbar.svelte';

	import { formatISODate, getCookie } from '$lib/utils';
	import type { Chat, User } from '$lib/types';

	let { chats = $bindable(), openedIndex }: { chats: Chat[], openedIndex?: number } = $props();
	let showAddChat = $state(false);
	let usernameInput = $state() as HTMLInputElement;

	let scrollableContent = $state() as HTMLElement;
	let scrollBar = $state() as Scrollbar;
	let bottom_anchor = $state() as HTMLElement;

	let showScrollbar = $state<boolean>();
	async function checkContentHeight() {
		await tick();
		if (!scrollableContent) {
			requestAnimationFrame(checkContentHeight);
			return;
		}
		//check if scrollbar is needed
		showScrollbar = scrollableContent.scrollHeight !== scrollableContent.clientHeight;

		//scroll to the last position
		scrollableContent.scrollTop = 0;
		// while (scrollableContent.scrollHeight < memory.chatsScroll) {
		// 	await tick();
		// 	requestAnimationFrame(()=> stacksLoaded++);
		// 	await tick()
		// }
		requestAnimationFrame(() => {
			scrollableContent.scrollTo({
				top: memory.chatsScroll,
				behavior: 'instant'
			});
		});
	}

	$effect(() => {
		lastChats;
		checkContentHeight();

		requestAnimationFrame(async () => {
			await tick();
			if (scrollBar) observer.observe(bottom_anchor);
		});
	});

	let observer: IntersectionObserver;
	onMount(async () => {
		await checkContentHeight();

		//bottom_anchor observer for lazy loading
		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach(async (entry) => {
					if (entry.isIntersecting) {
						const isDragging = scrollBar.isDraggingOn();
						if (isDragging) scrollBar.onMouseUp();

						//load more messages
						stacksLoaded++;

						if (isDragging) {
							await tick();
							scrollBar.onMouseDown();
						}
					}
				});
			},
			{ threshold: 0.1 }
		);

		const { cid } = page.params;
		const index = chats.findIndex((chat: Chat) => chat._id === cid);
		console.log(index);
	});

	const chatsPerStack = 14;
	//dynamic loading of messages
	let stacksLoaded = $state(1);
	let indexesToShow = $derived(
		(chats?.length || 0) >= stacksLoaded * chatsPerStack + (openedIndex ?? 0)
			? stacksLoaded * chatsPerStack + (openedIndex ?? 0)
			: chats?.length || 0
	);
	let lastChats = $derived(chats?.slice(0, indexesToShow));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id="chats-section"
	onmouseover={showScrollbar ? scrollBar.show : null}
	onmouseleave={showScrollbar ? scrollBar.hide : null}
	onfocus={showScrollbar ? scrollBar.show : null}
	onblur={showScrollbar ? scrollBar.hide : null}
>
	<h1 id="chats-list-title">Chats</h1>

	<div
		id="chats"
		bind:this={scrollableContent}
		onscroll={showScrollbar ? scrollBar.updateThumbPosition : null}
	>
		{#each lastChats as chat}
			<a
				href="{page.url.origin}/chat/{chat._id}"
				class="chat"
				class:current={page.url.pathname === `/chat/${chat._id}`}
			>
				<img
					src={''}
					alt={chat.users.find((user: User) => user.uid !== getCookie('uid'))!.username}
					class="profile-picture"
				/>
				<p class="chat-name">
					{chat.users.find((user: User) => user.uid !== getCookie('uid'))!.username}
				</p>
				<p class="chat-message" class:system-message={!chat.messages.length}>
					{chat.messages[chat.messages.length - 1]?.text ?? 'No messages'}
				</p>
				<p class="send-date">{formatISODate(chat.lastModified)}</p>
			</a>
		{/each}
		<div bind:this={bottom_anchor} class="anchor"></div>
	</div>
	{#if showScrollbar}
		<Scrollbar
			bind:this={scrollBar}
			{scrollableContent}
			width={0.4}
			bind:lastScroll={memory.chatsScroll}
		/>
	{/if}

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
</div>

{#if showAddChat}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
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
	#chats-section {
		height: 94vh;
		display: grid;
		grid-template-rows: auto 0 1fr;

		position: relative;
		background-color: var(--primary-bg-color);
	}

	#chats-list-title {
		grid-row: 1;
		padding: 0.6rem 0 0.4rem 0;
		justify-self: center;
	}

	#chats {
		grid-row: 3;
		overflow: scroll;
		padding: 0 0.4rem;

		.chat {
			display: grid;
			grid-template-columns: auto 1fr;
			grid-template-rows: auto 4rem auto;
			grid-gap: 0 1rem;
			align-items: center;
			padding: 0.4rem;
			border: 1px solid var(--secondary-bg-color);
			text-decoration: none;

			&:hover {
				cursor: pointer;
				background-color: var(--primary-hover-bg-color);
				color: var(--primary-hover-text-color);
			}

			&.current {
				background-color: rgba(51, 102, 153, 0.5);
			}

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
				font-weight: 600;
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
				font-size: 0.9rem;
				font-weight: 300;
			}
		}

		.anchor {
			height: 1px;
			width: 100%;
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
		grid-row: 2;

		position: sticky;

		height: 3rem;
		margin-top: calc(94vh - 6.2rem);
		margin-left: calc(100% - 3.2rem);
		transform: translateX(-0.6rem);

		background-color: #0065e1;
		border: none;
		cursor: pointer;
		border-radius: 0.6rem;
		z-index: 5;

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
