<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import '$lib/style.scss';
    import './website-style.scss';
</script>


<div id="website">
    <Header />
    
    <main>
        <slot />
    </main>
    
    <Footer />
</div>