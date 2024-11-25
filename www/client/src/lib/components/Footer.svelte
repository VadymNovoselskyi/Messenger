<script lang="ts">
    import Nav from '$lib/components/Nav.svelte';
    import type { Link } from '$lib/types';

    const links: Link[] = [
        { path: '/', title: 'Home'},
        { path: '/login', title: 'Login' },
        { path: '/signup', title: 'Signup' },
    ];
</script>

<footer>
    <h1>Messenger Footer</h1>
    <Nav {links}/>
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