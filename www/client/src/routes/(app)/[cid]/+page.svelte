<script lang="ts">
    import { page } from '$app/stores';
    import { memory } from '$lib/stores/memory.svelte';
    import { getWS, sendMessage } from '$lib/api';

    import ChatList from '$lib/components/ChatList.svelte';
    import MessageList from '$lib/components/MessageList.svelte';
    import MessageField from '$lib/components/MessageField.svelte';

    const ws = getWS();

    ws.addEventListener('open', () => {
        console.log("Connected to the ws");
    });

    let cid = $derived($page.params.cid);
    let { messages } = $derived(memory.chats.find(chat => chat._id === cid))!;
</script>

<svelte:head>
    <title>Chats</title>
</svelte:head>


<div id="wrapper">
    <section id="chats-list">
        <h1 id="chats-list-title">Chats</h1>
        <ChatList bind:chats={memory.chats} />
    </section>

    <section id="chat-display">
        <MessageList {messages} />
    </section>

    <section id="message-field">
        <MessageField submitFn={sendMessage} />
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
        
        background-color: var(--primary-background-color);
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
        padding: 0 1rem;
        
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        grid-auto-rows: max-content;
        
        background-color: #3a506b;
        max-height: 94vh;
        overflow-y: auto;
        scrollbar-width: thin;
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