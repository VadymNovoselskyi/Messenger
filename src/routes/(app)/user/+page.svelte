<script>
    import ChatList from '$lib/components/ChatList.svelte';
    let chats = [
        { img_src: '', title: 'Name1', message: 'lorem bla bla' },
        { img_src: '', title: 'Name2', message: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Inventore, fugiat. Inventore veritatis doloremque voluptate iure nesciunt assumenda qui alias temporibus beatae dolores dolore aspernatur laudantium, cupiditate sint, unde esse earum.' },
        { img_src: '', title: 'Name3', message: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Inventore, fugiat. Inventore veritatis doloremque voluptate iure nesciunt assumenda qui alias temporibus beatae dolores dolore aspernatur laudantium, cupiditate sint, unde esse earum.' },
        { img_src: '', title: 'Name4', message: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Inventore, fugiat. Inventore veritatis doloremque voluptate iure nesciunt assumenda qui alias temporibus beatae dolores dolore aspernatur laudantium, cupiditate sint, unde esse earum.' },
        { img_src: '', title: 'Name5', message: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Inventore, fugiat. Inventore veritatis doloremque voluptate iure nesciunt assumenda qui alias temporibus beatae dolores dolore aspernatur laudantium, cupiditate sint, unde esse earum.' },
        { img_src: '', title: 'Name6', message: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Inventore, fugiat. Inventore veritatis doloremque voluptate iure nesciunt assumenda qui alias temporibus beatae dolores dolore aspernatur laudantium, cupiditate sint, unde esse earum.' }
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
        <h3>Lorem ipsum dolor sit amet consectetur adipisicing elit. Voluptates dicta praesentium harum earum maxime amet vel sed aliquid enim optio dolore pariatur reiciendis, commodi dolores autem est laborum saepe ipsum.</h3>
        <h3>Repudiandae consequuntur rerum ratione minus sapiente iure, laudantium molestias autem ex eos dolorum totam a! Aspernatur, maiores sint tempora at praesentium eos quidem quaerat odit dolores fugit, veritatis, nisi voluptas.</h3>
        <h3>Necessitatibus accusamus soluta, repudiandae id ratione error hic ducimus magni molestias iure praesentium eum sapiente, blanditiis quos voluptas cupiditate nemo eaque, repellat porro laborum? Suscipit iure a dolor eos officia?</h3>
        <h3>Amet animi assumenda, quam sint accusantium sapiente ullam cumque molestias. Optio quia animi et rerum sint excepturi. Similique autem, commodi corrupti eos earum tempora cupiditate sed sit cum sunt maiores.</h3>
        <h3>Quam vel architecto dolores veritatis aperiam eligendi tenetur, laborum, hic, facere pariatur id adipisci mollitia minima distinctio quo quas perferendis doloremque vitae molestiae quae ut deleniti quisquam consequatur. At, eveniet.</h3>
        <h3>Voluptatem, corporis sunt qui quas dolorem asperiores tenetur repudiandae enim quos. Odit voluptas aperiam quis dolores? Repudiandae provident obcaecati, blanditiis numquam minima consectetur accusantium deserunt hic voluptate. Deserunt, beatae exercitationem.</h3>
        <h3>Provident fugiat eos natus beatae unde a hic quas magni, blanditiis ratione cupiditate? Quam incidunt voluptatem eum quia, facere ducimus quis a saepe, perferendis, voluptates fugit vitae corrupti et magnam?</h3>
        <h3>Labore aliquid esse ut animi porro fuga rem inventore, eum quod veniam dicta, ipsam amet omnis delectus praesentium exercitationem quam quas illum voluptatem voluptates nam incidunt tenetur. Eveniet, dignissimos eaque!</h3>
        <h3>Itaque non numquam vitae, debitis aliquid perspiciatis illum minus ut porro at nam ad nemo minima qui aperiam hic et. Optio explicabo porro similique eligendi veritatis sed dignissimos ullam dolorem!</h3>
        <h3>Atque incidunt, dignissimos, corrupti vel possimus quam hic tempore rem dolorum recusandae, non sit quae cupiditate consequuntur ratione deserunt doloribus ipsum corporis harum optio. Suscipit accusamus eos accusantium at eveniet!</h3>
        <h3>Similique commodi natus aperiam in sapiente, aliquid non laborum quam molestias impedit fuga iste corrupti dolorem illo dolor dignissimos illum accusamus temporibus aut totam voluptates tempore culpa a. Amet, illum.</h3>
        <h3>Cupiditate quo itaque labore temporibus reiciendis consequuntur nulla eos veritatis quod corrupti delectus, libero repudiandae dolorum, alias cumque repellendus quas eveniet asperiores natus sequi ex culpa tempore voluptates. Eius, sit?</h3>
        <h3>Obcaecati sed praesentium adipisci harum, dolore minus magnam rerum commodi voluptatibus velit optio ea non nobis voluptatum, a eos delectus voluptas quo debitis autem in eligendi voluptates cum. Nostrum, facilis!</h3>
        <h3>Tempora, vitae animi amet itaque asperiores soluta, perspiciatis enim recusandae reprehenderit sit eos distinctio optio neque inventore a quae, iste dicta quos eaque quo laboriosam suscipit doloribus nesciunt. Facilis, beatae.</h3>
        <h3>Laudantium, quasi blanditiis deserunt ducimus fugiat voluptate. Iure ipsam placeat sunt aliquid! Eos, accusamus mollitia, vitae suscipit consequuntur corrupti ipsum, reiciendis totam voluptas expedita qui voluptatibus quaerat eum dolorem facilis.</h3>
        <h3>Vitae cupiditate ducimus veritatis autem consequatur labore, eligendi asperiores vel eaque aspernatur recusandae ad harum quidem, modi sint sed doloribus saepe, obcaecati provident quisquam. Molestias deserunt veritatis deleniti nostrum ea!</h3>
        <h3>Nostrum, expedita eius impedit neque optio dolorem adipisci dignissimos cumque ea vitae doloribus, quos illum molestias ipsam quis explicabo quisquam fugit veritatis odit officiis. Ullam eaque deleniti quaerat magnam quos.</h3>
        <h3>Sapiente recusandae, nostrum cumque quis porro fugiat, architecto et dolore rem, inventore eveniet voluptas soluta autem quia enim ea perferendis eaque? Earum repellat dolorem quisquam rerum blanditiis dignissimos amet odit.</h3>
        <h3>Incidunt unde perspiciatis sed eaque earum odio magni voluptatem modi, cum nihil quia a ut ullam voluptas quas. Necessitatibus corrupti numquam esse inventore dignissimos voluptas earum aliquam consectetur. Fuga, placeat.</h3>
        <h3>Error earum consequatur nesciunt saepe aspernatur perferendis, laboriosam numquam voluptatibus iste facere esse impedit nobis ad rerum cupiditate doloribus repellendus necessitatibus labore itaque voluptas et. Magnam recusandae assumenda fugit veritatis.</h3>
    </section>
</div>

<style lang="scss">
#wrapper {
    display: grid;
    grid-template-columns: minmax(14rem, 3fr) 7fr;
    grid-template-rows: auto 1fr;
    grid-gap: 0 var(--main-padding);
    max-height: calc(94vh - 2 * var(--main-padding));
    overflow: hidden;
    
    #chats-list {
        grid-column: 1;

        overflow-y: auto;
        scrollbar-width: thin;
    }
    #chat-display {
        grid-column: 2;
        background-color: #fff;

        overflow-y: auto;
        scrollbar-width: thin;
    }
}
</style>