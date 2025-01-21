<script lang="ts">
    import { page } from '$app/stores';
    import { formatISODate, getCookie } from '$lib/utils';
    import type { Chat, User } from '$lib/types';
    

    let { chats }: { chats: Chat[] } = $props();
    let showAddChat = $state(false);
</script> 

{#each chats as chat} 
    <a href='{$page.url.origin}/{chat._id}' class="chat">
        <img src={''} alt='{chat.users.find((user: User) => user.uid !== getCookie("uid"))!.name}' class="profile-picture"> 
        <h3 class="chat-name">{chat.users.find((user: User) => user.uid !== getCookie("uid"))!.name}</h3>
        <p class="chat-message">{chat.messages[chat.messages.length - 1].text}</p>
        <p class="send-date">{formatISODate(chat.lastModified)}</p>
    </a>
{/each}

<button id="add-chat" onclick={()=>showAddChat = true}>
    <i class="fa-solid fa-square-plus"></i>
</button>

{#if showAddChat}
    <div class="popup-menu" class:active={showAddChat}>
        <form>
            <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" placeholder="Enter your name">
            </div>
            <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" placeholder="Enter your email">
            </div>
            <div class="form-group">
            <label for="message">Message:</label>
            <textarea id="message" name="message" placeholder="Enter your message"></textarea>
            </div>
            <button type="submit">Submit</button>
        </form>
    </div>
{/if}

<style lang="scss"> 
.chat {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto 4rem auto;
    grid-gap: 0 1rem;
    align-items: center;
    padding: 0.4rem;
    border: 1px solid var(--secondary-bg-color); 
    text-decoration: none;
    
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
        max-height: 4rem;
        overflow: hidden;
    }

    .send-date {
        grid-column: span 2;
        grid-row: 3;

        justify-self: end;
    }

    &:hover {
        cursor: pointer;
        background-color: var(--primary-hover-bg-color);
        color: var(--primary-hover-text-color);
    }
}
#add-chat {
    position: absolute;
    inset-block-end: 0.1rem;
    inset-inline-end: 0.5rem;
    background-color: var(--primary-bg-color);
    border: none;
    cursor: pointer;

     i {font-size: 2.6rem}
}

.popup-menu {
  position: absolute;
  top: 50%;
  left: 50%;
  background-color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #ddd;
  border-radius: 4px;
  z-index: 10;
  padding: 1rem;
  width: 300px;

  .form-group {
    margin-bottom: 1rem;

        label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
        }

        input, textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 1rem;
        }

    }

    button[type="submit"] {
      background-color: #007bff;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      &:hover {
        background-color: #0056b3;
      }
    }
}



</style>