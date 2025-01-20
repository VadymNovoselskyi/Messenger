<script lang="ts">
    function defaultFN(event: Event) {
        event.preventDefault;
    }

    let { submitFn = defaultFN } = $props();
</script>

<svelte:head>
    <script src="https://kit.fontawesome.com/00ab35ae35.js" crossorigin="anonymous"></script>
</svelte:head>

<form action="" onsubmit={submitFn}>
    <input id="message-input" type="text" name="message" placeholder="Type your text here" autocomplete="off">
    <button id="send-icon">
        <i class="fa-solid fa-paper-plane"></i>
    </button>
</form>

<style lang="scss">
#message-input {
    padding: 6px;
    margin-right: 10px;
    border: none;
    font-size: 17px;
    border-radius: 4px;
}

#send-icon {
    padding: 6px 10px;
    background-color: white;
    border: none;
    cursor: pointer;
    border-radius: 4px;
}
</style>
