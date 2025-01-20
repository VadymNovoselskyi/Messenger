<!-- ToDo -->
<!-- Remove hardcoded 'me' to actual users name (stores???) -->
<script lang="ts">
    import { page } from '$app/stores';
    import { formatISODate } from '$lib/utils';
    import type { Chat } from '$lib/types';

    let { chats }: { chats: Chat[] } = $props();
</script> 

{#each chats as chat} 
    <a href='{$page.url.origin}/{chat._id}' class="chat">
        <img src={''} alt='{chat.users.find((name: string) => name !== 'me')}' class="profile-picture"> 
        <h3 class="chat-name">{chat.users.find((name: string) => name !== 'me')}</h3>
        <p class="chat-message">{chat.messages[chat.messages.length - 1].text}</p>
        <p class="send-date">{formatISODate(chat.lastModified)}</p>
    </a>
{/each}

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
</style>