<script>
    import ChatList from '$lib/components/ChatList.svelte';
    let chats = [
        { img_src: '', title: 'Name1', message: 'lorem bla bla' },
        { img_src: '', title: 'Name2', message: 'lorem bla bla bla bla bla bla bla' }
    ]
</script>

<svelte:head>
    <title>Chats</title>
</svelte:head>

<div id="wrapper">
    <h1>Chats</h1>
    <section id="chats-list">
        <ChatList {chats} />
    </section>

    <section id="chat-display">
        <h1>Lorem, ipsum dolor sit amet consectetur adipisicing elit. Inventore, fugiat. Inventore veritatis doloremque voluptate iure nesciunt assumenda qui alias temporibus beatae dolores dolore aspernatur laudantium, cupiditate sint, unde esse earum.</h1>
        <h1>Alias illo dolore ducimus in, nesciunt cumque. Nisi mollitia quisquam ipsa quis cupiditate repudiandae. Error eaque nesciunt reiciendis? Similique deserunt debitis ex fuga magnam porro enim voluptatem ad voluptatum temporibus.</h1>
        <h1>Labore, libero. Neque minima doloremque eveniet dolorem autem, perferendis ex asperiores labore aliquam amet rem ab libero repellendus dolores sit nulla id facilis? Tempora nemo, praesentium laudantium dolores debitis odio!</h1>
        <h1>Possimus, voluptatem nisi dolorem, vero autem optio dignissimos accusantium neque eum repellat totam deserunt qui distinctio harum sapiente quae non aspernatur esse dolores, odit earum culpa. Totam officia quis nulla!</h1>
        <h1>Dolore adipisci expedita perspiciatis in atque. Fuga quasi recusandae eius hic totam, quam, cupiditate omnis aut explicabo possimus aperiam ad, neque praesentium optio sunt aliquam quis officiis similique tenetur inventore.</h1>
    </section>
</div>

<style lang="scss">
    #wrapper {
        display: grid;
        grid-template-columns: minmax(14rem, 7fr) 13fr;
        grid-template-rows: auto 1fr;
        grid-gap: 0 3rem;
        max-height: calc(94vh - 2 * var(--main-padding));
        overflow: hidden;
        
        #chats-list {
            grid-column: 1;

            overflow-y: auto;
            scrollbar-width: none;

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
        }
        
        #chat-display {
            grid-column: 2  ;
        }
    }
</style>