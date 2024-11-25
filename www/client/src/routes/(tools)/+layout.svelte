<script>
    import Nav from '$lib/components/Nav.svelte';
    import '$lib/style.scss';
    import './tools-style.scss';

    const links = [
        { path: '/user', title: 'Chats' },
        { path: '/user/search', title: 'Search' },
        { path: '/user/profile', title: 'Profile' },
        { path: '/user/settings', title: 'Settings' }
    ];
    const id = 'toolbar';
</script>

<div id="tools">
    <main>
        <slot />
    </main>
    
    <Nav {links} {id}/>
</div>
