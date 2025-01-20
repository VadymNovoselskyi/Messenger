<script lang="ts">
    import { formatISODate } from '$lib/utils';
    import type { Message } from '$lib/types';

    let { messages}: { messages: Message[] | null} = $props();
</script>

{#if messages} 
    {#each messages as message}
        <div class="message" class:sent={message.from === 'me'} class:received={message.from !== 'me'}>
            <h3 class="text">{message.text}</h3>
            <p class="sendTime">{formatISODate(message.sendTime)}</p>
        </div>
    {/each}
{:else}
    <div class="error-container">
        <div id="error_message">
            <p>Fetching is in progress!</p>
        </div>
    </div>
{/if}
<div id="anchor"></div>
<style lang="scss">
    .message {
        overflow-anchor: none;
        padding: 0.6rem;
        border-radius: 1rem;
        margin: 1rem 0;

        .sendTime {
            justify-self: end;
        }
    }

    .received {
        grid-column: 1/7;
        background-color: #edf6f9;
    }

    .sent {
        grid-column: 5/11;
        background-color: #83c5be;
    }

    #anchor {
        overflow-anchor: auto;
        height: 1px;
    }

    /* Parent container for centering */
    .error-container {
        grid-column: span 10;
        position: relative; /* Ensures the child is positioned relative to this container */
        display: flex; /* Flexbox for alignment */
        justify-content: center; /* Horizontally centers the child */
        align-items: center; /* Vertically centers the child */
        height: 100vh; /* Full height to simulate a fullscreen parent */
        width: 100%; /* Full width to ensure proper centering */
    }

    /* Error message styling */
    #error_message {
        background-color: rgba(255, 0, 0, 0.1); /* Soft red background */
        color: #ff0000; /* Red text for error indication */
        border: 1px solid #ff0000; /* Highlighted border */
        border-radius: 8px; /* Rounded corners */
        padding: 20px 40px; /* Spacing inside the message box */
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); /* Subtle shadow for depth */
        font-family: Arial, sans-serif; /* Clean font for readability */
        font-size: 18px; /* Larger text for clarity */
        text-align: center; /* Center-align the text */
    }

</style>