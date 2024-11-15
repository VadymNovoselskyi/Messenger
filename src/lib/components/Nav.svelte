<script>
    import { page } from '$app/stores'
</script>

<nav>
    <ul>
        <li><a href="/" class:current={$page.url.pathname === '/'}>Home</a></li>
        <li><a href="/login" class:current={$page.url.pathname === '/login'} >Login</a></li>
        <li><a href="/signup" class:current={$page.url.pathname === '/signup'} >Signup</a></li>
    </ul>
</nav>

<style lang="scss">
    ul {
        display: grid;
        grid-auto-columns: minmax(6rem, 1fr);
        grid-auto-flow: column;
        justify-items: center;
        font-size: 1.2rem;

        li {
            list-style: none;

            a {
                text-decoration: none;
                position: relative;

                &.current {
                    color: #ff6347;
                }

                &:not(.current)::before {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 3px;
                    border-radius: 4px;
                    background-color: var(--primaty-bg-color);
                    bottom: 0;
                    left: 0;
                    transform-origin: right;
                    transform: scaleX(0);
                    transition: transform .3s ease-in-out;
                }
                &:not(.current):hover {
                    transition: color .3s ease-in-out;
                    color: #bada55;
                    &::before {
                        transform-origin: left;
                        transform: scaleX(1);
                    }
                }
            } 
        }
    }
</style>