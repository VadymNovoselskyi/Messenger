<script>
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import '$lib/style.scss'
</script>

<Header />
<main>
    <slot />
</main>

<Footer />
    