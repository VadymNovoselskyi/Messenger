<script lang="ts">
    import { memory } from '$lib/stores/memory.svelte';
    import ChatList from '$lib/components/ChatList.svelte';
    import MessageField from '$lib/components/MessageField.svelte';

    import { requestChats } from '$lib/api.svelte'
</script>

<svelte:head>
    <title>Chats</title>
</svelte:head>


<div id="wrapper">
    <section id="chats-list">
        <h1 id="chats-list-title">Chats</h1>
        
        <ChatList chats={memory.chats} /> 
        {#if !memory.chats.length}
            {#await requestChats()}
                <p>Fetching is in progress!</p>
            {:catch error}
                <p>{error.message}</p>
            {/await}
        {/if}
    </section>

    <section id="chat-display"></section>

    <section id="message-field">
        <MessageField />
    </section>
</div>


<style lang="scss">
#wrapper {
    display: grid;
    grid-template-columns: minmax(14rem, 3fr) 8fr;
    grid-template-rows: 1fr auto;
    height: 94vh;
    overflow: hidden;
    
    #chats-list {
        grid-column: 1;   
        grid-row: span 2;     
        padding: 2rem 0.4rem;
        
        background-color: var(--primary-bg-color);
        max-height: 94vh;
        overflow-y: auto;
        scrollbar-width: thin;

        #chats-list-title {
            justify-self: center;
        }
    }

    #chat-display {
        grid-column: 2;
        grid-row: 1;
        background-color: #3a506b;
    }

    #message-field {
        grid-column: 2;
        grid-row: 2;
        justify-items: center;
        width: 100%;

        padding: 0.4rem;
        background-color: #3a506b;
    }
}
</style>