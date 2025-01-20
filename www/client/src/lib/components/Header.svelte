<script lang="ts">
    import Nav from "$lib/components/Nav.svelte";
    import type { Link } from '$lib/types';

    const links: Link[] = [
        { path: '/', title: 'Home'},
        { path: '/login', title: 'Login' },
        { path: '/signup', title: 'Signup' },
    ];
</script>

<header>
    <h1>Messenger Header</h1>
    <Nav {links}/>
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
