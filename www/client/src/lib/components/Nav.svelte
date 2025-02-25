<script lang="ts">
	import { page } from '$app/state';
	import type { Link } from '$lib/types';

	let { links, id }: { links: Link[]; id: string } = $props();
	const currentPath = page.url.pathname;
</script>

<nav>
	<ul {id}>
		{#each links as { path, title, pathsToCheck }}
			<li>
				<a href={path} class:current={pathsToCheck?.includes(path) ?? currentPath === path}
					>{title}</a
				>
			</li>
		{/each}
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
					background-color: var(--primary-bg-color);
					bottom: 0;
					left: 0;
					transform-origin: right;
					transform: scaleX(0);
					transition: transform 0.3s ease-in-out;
				}
				&:not(.current):hover {
					transition: color 0.3s ease-in-out;
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
