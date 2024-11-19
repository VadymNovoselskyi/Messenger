<script>
    export let chats = [
        { img_src: '', title: 'Name1', message: 'lorem bla bla' },
        { img_src: '', title: 'Name2', message: 'lorem bla bla bla bla bla bla bla' }
    ]
</script>

{#each chats as { img_src, title, message }}
    <section class="chat">
        <img src={img_src} alt={title} class="profile-picture">
        <h3 class="chat-name">{title}</h3>
        <p class="chat-message">{message}</p>
    </section>  
{/each}