<!-- ToDo -->
<!-- Remove hardcoded 'me' to actual users name (stores???) -->
<script lang="ts">
    import { page } from '$app/stores';
    import type { Chat } from '$lib/types';

    let { chat }: { chat: Chat } = $props();

    const contact = chat.users.find((name: string) => name !== 'me');
    const lastMessage = chat.messages[chat.messages.length - 1].text;

    function formatDate(isoDate: string): string {
        const date = new Date(isoDate);
        const now = new Date();
        
        const isSameYear = date.getFullYear() === now.getFullYear();
        if(!isSameYear) return `${date.getHours()}:${date.getMinutes()}, ${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;
        
        const isSameDay = date.getDate() === now.getDate();
        const isSameMonth = date.getMonth() === now.getMonth();
        if(!isSameDay || !isSameMonth) return `${date.getHours()}:${date.getMinutes()}, ${date.getDate()}-${date.getMonth()}`;

        return `${date.getHours()}:${date.getMinutes()}`;
    }
</script> 

<a href='{$page.url.pathname}/{chat._id}' class="chat">
    <img src={''} alt='{contact}' class="profile-picture"> 
    <h3 class="chat-name">{contact}</h3>
    <p class="chat-message">{lastMessage}</p>
    <p class="send-date">{formatDate(chat.lastUpdate)}</p>
</a>

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