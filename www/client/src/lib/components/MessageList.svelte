<script lang="ts">
    import type { Message } from '$lib/types';

    export let messages: Message[] = [
        { message: 'lorem bla bla', isSent: true},
        { message: 'lorem bla bla bla bla bla bla bla', isSent: false }
    ]
</script>

{#each messages as { message, isSent }}
    <h3 class="message" class:sent={isSent} class:received={!isSent}>{message}</h3>
{/each}

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