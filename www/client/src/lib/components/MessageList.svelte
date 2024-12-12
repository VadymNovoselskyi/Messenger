<script lang="ts">
    import type { Message } from '$lib/types';

    const { message }: { message: Message} = $props();
</script>

<h3 class="message" class:sent={message.isSent} class:received={!message.isSent}>{message.text}</h3>

<style lang="scss">
    .message {
        padding: 0.6rem;
        border-radius: 1rem;
        margin: 1rem 0;
    }

    .received {
        grid-column: 1/7;
        background-color: #edf6f9;
    }

    .sent {
        grid-column: 5/11;
        background-color: #83c5be;
    }
</style>