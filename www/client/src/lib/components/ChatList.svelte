<script lang="ts">
	import { page } from '$app/stores';
    import { addChat } from '$lib/api.svelte';
	import { formatISODate, getCookie } from '$lib/utils';
	import type { Chat, User } from '$lib/types';

	let { chats }: { chats: Chat[] } = $props();
	let showAddChat = $state(false);
</script>

<svelte:head>
    <script src="https://kit.fontawesome.com/00ab35ae35.js" crossorigin="anonymous"></script>
</svelte:head>

{#each chats as chat}
	<a href="{$page.url.origin}/{chat._id}" class="chat">
		<img
			src={''}
			alt={chat.users.find((user: User) => user.uid !== getCookie('uid'))!.name}
			class="profile-picture"
		/>
		<h3 class="chat-name">
			{chat.users.find((user: User) => user.uid !== getCookie('uid'))!.name}
		</h3>
		<p class="chat-message">{chat.messages[chat.messages.length - 1].text}</p>
		<p class="send-date">{formatISODate(chat.lastModified)}</p>
	</a>
{/each}

<button id="add-chat" onclick={() => (showAddChat = !showAddChat)}>
	<i class="fa-solid fa-square-plus"></i>
</button>

{#if showAddChat}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="popup-overlay" onclick={()=> showAddChat = false}></div>
	<div class="popup-menu" class:active={showAddChat}>
        <button class="close-popup" onclick={()=> showAddChat = false}>x</button>
		<form onsubmit={(event: SubmitEvent)=> {
            addChat(event);
            showAddChat = false;
            }}>
			<label for="name">Username:</label>
			<input type="text" id="username" name="username" placeholder="Username you want to add" />
			<button type="submit">Add</button>
		</form>
	</div>
{/if}

<style lang="scss">
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
		}

		.chat-message {
			grid-column: 2;
			grid-row: 2;
			max-height: 4rem;
			overflow: hidden;
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
	#add-chat {
		position: absolute;
		bottom: 0.1rem;
		right: 0.5rem;
		background-color: var(--primary-bg-color);
		border: none;
		cursor: pointer;

		i {
			font-size: 2.6rem;
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
