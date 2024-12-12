<script lang="ts">
    import type { Chat } from '$lib/types';

    let { chat }: { chat: Chat } = $props();
</script> 

<section class="chat">
    <img src={''} alt='Some alt' class="profile-picture"> 
    <h3 class="chat-name">Some name</h3>
    <p class="chat-message">Last message</p>
</section>  

<style lang="scss"> 
.chat {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto minmax(2rem, 5rem);
    grid-gap: 0.4rem 1rem;
    align-items: center;
    padding: 0.4rem;
    border: 1px solid var(--secondary-bg-color); 
    
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
        max-height: 5rem;
        overflow: hidden;
    }

    &:hover {
        cursor: pointer;
        background-color: var(--primary-hover-bg-color);
        color: var(--primary-hover-text-color);
    }
}
</style>