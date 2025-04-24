<script lang="ts">
    import type { Link } from '$lib/types/dataTypes';
    import Nav from '$lib/components/Nav.svelte';
    import '$lib/style.scss';
    import './tools-style.scss';

    const links: Link[] = [
        { path: '/', title: 'Chats' },
        { path: '/search', title: 'Search' },
        { path: '/profile', title: 'Profile' },
        { path: '/settings', title: 'Settings' }
    ];
    const id = 'toolbar';
</script>

<div id="tools">
    <main>
        <slot />
    </main>
    
    <Nav {links} {id}/>
</div>
