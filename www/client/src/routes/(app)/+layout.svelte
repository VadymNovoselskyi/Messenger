<script lang="ts">
    import type { Link } from '$lib/types';
    import Nav from '$lib/components/Nav.svelte';
    import '$lib/style.scss';
    import './app-style.scss';

    const links: Link[] = [
        { path: '/', title: 'Chats', pathsToCheck: ['/', '/chat'] },
        { path: '/search', title: 'Search' },
        { path: '/profile', title: 'Profile' },
        { path: '/settings', title: 'Settings' }
    ];
    const id = 'toolbar';
</script>

<div id="app">
    <main>
        <slot />
    </main>
    
    <Nav {links} {id}/>
</div>