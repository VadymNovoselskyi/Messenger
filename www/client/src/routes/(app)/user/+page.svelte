<script lang="ts">
    import { page } from '$app/stores';
    import ChatList from '$lib/components/ChatList.svelte';
    import MessageList from '$lib/components/MessageList.svelte';
    import MessageField from '$lib/components/MessageField.svelte';
    import type { Chat, Message } from '$lib/types';

    const wsConnectionPromise: Promise<WebSocket> = new Promise((resolve, reject) => {
        resolve(new WebSocket(`${$page.url.origin}/api/`));
    });

    wsConnectionPromise.then((ws: WebSocket) => {
        ws.addEventListener('open', () => {
            console.log("Connected to the ws");

            ws.send(JSON.stringify({
                api: 'get_chats',
                uid: 'me'
            }));
        });

        ws.addEventListener('message', event => { 
            const { data } = event;
            const response = JSON.parse(data);
            console.log(response);

            switch(response.api) {
                case 'get_chats':
                    const { chats } = response;
                    chats.forEach((dataBit: any) => console.log(dataBit));
                    break;
                
                default:
                    console.error('Uknown api call');
            }
        });
    });

    let chats: Chat[] = [
        { imgSrc: '', title: 'Name1', message: 'lorem bla bla', lastUpdate: '12:14' }
    ];

    let messages: Message[] = [
        { message: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptates dicta praesentium harum earum maxime amet vel sed aliquid enim optio dolore pariatur reiciendis, commodi dolores autem est laborum saepe ipsum.', isSent: true},
        { message: 'Repudiandae consequuntur rerum ratione minus sapiente iure, laudantium molestias autem ex eos dolorum totam a! Aspernatur, maiores sint tempora at praesentium eos quidem quaerat odit dolores fugit, veritatis, nisi voluptas.', isSent: false },
        { message: 'Necessitatibus accusamus soluta, repudiandae id ratione error hic ducimus magni molestias iure praesentium eum sapiente, blanditiis quos voluptas cupiditate nemo eaque, repellat porro laborum? Suscipit iure a dolor eos officia?', isSent: true},
        { message: 'Amet animi assumenda, quam sint accusantium sapiente ullam cumque molestias. Optio quia animi et rerum sint excepturi. Similique autem, commodi corrupti eos earum tempora cupiditate sed sit cum sunt maiores.', isSent: true },
        { message: 'Quam vel architecto dolores veritatis aperiam eligendi tenetur, laborum, hic, facere pariatur id adipisci mollitia minima distinctio quo quas perferendis doloremque vitae molestiae quae ut deleniti quisquam consequatur. At, eveniet.', isSent: true},
        { message: 'Voluptatem, corporis sunt qui quas dolorem asperiores tenetur repudiandae enim quos. Odit voluptas aperiam quis dolores? Repudiandae provident obcaecati, blanditiis numquam minima consectetur accusantium deserunt hic voluptate. Deserunt, beatae exercitationem.', isSent: false },
        { message: 'Atque incidunt, dignissimos, corrupti vel possimus quam hic tempore rem dolorum recusandae, non sit quae cupiditate consequuntur ratione deserunt doloribus ipsum corporis harum optio. Suscipit accusamus eos accusantium at eveniet!', isSent: true},
        { message: 'Cupiditate quo itaque labore temporibus reiciendis consequuntur nulla eos veritatis quod corrupti delectus, libero repudiandae dolorum, alias cumque repellendus quas eveniet asperiores natus sequi ex culpa tempore voluptates. Eius, sit?', isSent: false },
        { message: 'Labore aliquid esse ut animi porro fuga rem inventore, eum quod veniam dicta, ipsam amet omnis delectus praesentium exercitationem quam quas illum voluptatem voluptates nam incidunt tenetur. Eveniet, dignissimos eaque!', isSent: false},
        { message: 'Similique commodi natus aperiam in sapiente, aliquid non laborum quam molestias impedit fuga iste corrupti dolorem illo dolor dignissimos illum accusamus temporibus aut totam voluptates tempore culpa a. Amet, illum.', isSent: false },
        { message: 'Obcaecati sed praesentium adipisci harum, dolore minus magnam rerum commodi voluptatibus velit optio ea non nobis voluptatum, a eos delectus voluptas quo debitis autem in eligendi voluptates cum. Nostrum, facilis!', isSent: true},
        { message: 'Tempora, vitae animi amet itaque asperiores soluta, perspiciatis enim recusandae reprehenderit sit eos distinctio optio neque inventore a quae, iste dicta quos eaque quo laboriosam suscipit doloribus nesciunt. Facilis, beatae.', isSent: false }
    ]

    function sendForm(event: SubmitEvent) {
        event.preventDefault();
        const message = (event.target as HTMLFormElement)!.message.value;
        const receiver = 'contact1';

        // ws.send(JSON.stringify({
        //     api: 'send_message',
        //     uid: 'me',
        //     message
        // }));
    }
</script>

<svelte:head>
    <title>Chats</title>
</svelte:head>

<div id="wrapper">
    <section id="chats-list">
        <h1 id="chats-list-title">Chats</h1>
        <ChatList {chats} />
    </section>

    <section id="chat-display">
        <MessageList {messages} />
    </section>

    <section id="message-field">
        <MessageField 
            submitFn={sendForm}
        />
    </section>
</div>

<style lang="scss">
#wrapper {
    display: grid;
    grid-template-columns: minmax(14rem, 3fr) 7fr;
    grid-template-rows: 1fr auto;
    max-height: 94vh;
    overflow: hidden;
    
    #chats-list {
        grid-column: 1;   
        grid-row: span 2;     
        padding: 2rem 0.4rem;
        
        background-color: var(--primary-background-color);
        max-height: 94vh;
        overflow-y: auto;
        scrollbar-width: thin;

        #chats-list-title {
            justify-self: center;
        }
    }

    #chat-display {
        grid-column: 2;
        grid-row: 1;
        padding: 0 1rem;
        
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        
        background-color: #3a506b;
        max-height: 94vh;
        overflow-y: auto;
        scrollbar-width: thin;
    }

    #message-field {
        grid-column: 2;
        grid-row: 2;
        justify-items: center;
        width: 100%;

        padding: 0.4rem;
        background-color: #3a506b;
    }
}
</style>