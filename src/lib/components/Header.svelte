<script>
    import Nav from "$lib/components/Nav.svelte";
</script>

<header>
    <h1>Messenger Header</h1>
    <Nav />
</header>

<style lang="scss">
    header {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        justify-items: end;
        background-color: var(--secondary-bg-color);
        color: var(--secondary-text-color);
        padding: 1.6rem 1rem;
    }
</style>
