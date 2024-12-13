<script lang="ts">	
    import { page } from '$app/stores';
    
    import ChatList from '$lib/components/ChatList.svelte';
    import MessageList from '$lib/components/MessageList.svelte';
    import MessageField from '$lib/components/MessageField.svelte';
    import type { Chat, Message } from '$lib/types';


    function sendForm(event: SubmitEvent) {
        event.preventDefault();
        const message = (event.target as HTMLFormElement)!.message.value;
        const receiver = 'contact1';

        // ws.send(JSON.stringify({
        //     api: 'send_message',
        //     uid: 'me',
        //     message
        // }));
    }
</script>

<svelte:head>
    <title>Chats</title>
</svelte:head>


<div id="wrapper">
    <section id="chats-list">
        <h1 id="chats-list-title">Chats</h1>
            {#each chats as chat} 
                <ChatList {chat} />
            {/each}
            
            <section id="chat-display">
                {#each getChatsResponse.chats as { messages }}
                    <MessageList {messages} />
                {/each}
            </section>

    </section>

    <section id="chat-display"></section>

    <section id="message-field">
        <MessageField 
            submitFn={sendForm}
        />
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

<h1>{$page.params.cid}</h1>