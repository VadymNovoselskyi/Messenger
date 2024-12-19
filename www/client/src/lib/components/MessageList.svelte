<script lang="ts">
    import { formatISODate } from '$lib/utils';
    import type { Message } from '$lib/types';

    let { messages = $bindable()}: { messages: Message[]} = $props();
</script>

{#each messages as message}
    <div class="message" class:sent={message.from === 'me'} class:received={message.from !== 'me'}>
        <h3 class="text">{message.text}</h3>
        <p class="sendTime">{formatISODate(message.sendTime)}</p>
    </div>
{/each}
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
</style>