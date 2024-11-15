<script>
    import Nav from '$lib/components/Nav.svelte';
</script>

<footer>
    <h1>Messenger Footer</h1>
    <Nav />
</footer>

<style lang="scss">
    footer {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        justify-items: end;
        background-color: var(--secondary-bg-color);
        color: var(--secondary-text-color);
        padding: 1rem;
    }
</style>