<script>
    export let chats = [
        { imgSrc: '', title: 'Name1', message: 'lorem bla bla' },
        { imgSrc: '', title: 'Name2', message: 'lorem bla bla bla bla bla bla bla' }
    ]
</script> 

{#each chats as { imgSrc, title, message }} 
    <section class="chat">
        <img src={imgSrc} alt={title} class="profile-picture"> 
        <h3 class="chat-name">{title}</h3>
        <p class="chat-message">{message}</p>
    </section>  
{/each}

<style lang="scss"> 
.chat {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto minmax(2rem, 5rem);
    grid-gap: 0.4rem 1rem;
    align-items: center;
    padding: 0.4rem;
    border: 1px solid var(--secondary-bg-color); 
    
    .profile-picture {
        grid-column: 1;
        grid-row: span 2;
        width: 64px;
        height: 64px;
    }

    .chat-name {
        grid-column: 2;
        grid-row: 1;
    }
    
    .chat-message {
        grid-column: 2;
        grid-row: 2;
        max-height: 5rem;
        overflow: hidden;
    }

    &:hover {
        cursor: pointer;
        background-color: var(--primary-hover-bg-color);
        color: var(--primary-hover-text-color);
    }
}
</style>