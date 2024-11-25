<script lang="ts">
    import type { Link } from '$lib/types';
    import Nav from '$lib/components/Nav.svelte';
    import '$lib/style.scss';
    import './app-style.scss';

    const links: Link[] = [
        { path: '/user', title: 'Chats' },
        { path: '/user/search', title: 'Search' },
        { path: '/user/profile', title: 'Profile' },
        { path: '/user/settings', title: 'Settings' }
    ];
    const id = 'toolbar';
</script>

<div id="app">
    <main>
        <slot />
    </main>
    
    <Nav {links} {id}/>
</div>

<style lang="scss">
    
</style>