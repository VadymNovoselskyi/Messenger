<script lang="ts">
    import { onMount } from 'svelte'
	let { scrollableContent }: { scrollableContent: HTMLElement } = $props();

	let scrollableThumb: HTMLElement;
	let isDragging = $state(false);
	let startY = 0;
	let startScrollTop = 0;
	let animationFrameId: number | null;

	export function updateThumbPosition(): void {
		const contentHeight = scrollableContent.scrollHeight;
		const visibleHeight = scrollableContent.clientHeight;
		const scrollTop = scrollableContent.scrollTop;

		const thumbHeight = Math.max((visibleHeight / contentHeight) * visibleHeight, 20);
		const thumbPosition = (scrollTop / contentHeight) * visibleHeight + scrollTop;

		scrollableThumb.style.height = `${thumbHeight}px`;
		scrollableThumb.style.transform = `translateY(${thumbPosition}px)`;
	}

	export function onMouseDown(event: MouseEvent): void {
		isDragging = true;
		startY = event.clientY;
		startScrollTop = scrollableContent.scrollTop;

		// Disable text selection while dragging.
		document.body.style.userSelect = 'none';

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	export function onMouseMove(event: MouseEvent): void {
		if (!isDragging) return;
		const deltaY = event.clientY - startY;
		const contentHeight = scrollableContent.scrollHeight;
		const visibleHeight = scrollableContent.clientHeight;

		// Ensure a minimum thumb height of 20px.
		const thumbHeight = Math.max((visibleHeight / contentHeight) * visibleHeight, 20);
		const scrollRatio = (contentHeight - visibleHeight) / (visibleHeight - thumbHeight);
		scrollableContent.scrollTop = startScrollTop + deltaY * scrollRatio;

		// Throttle thumb updates using requestAnimationFrame.
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
		}
		animationFrameId = requestAnimationFrame(updateThumbPosition);
	}

	export function onMouseUp(): void {
		isDragging = false;

		// Re-enable text selection.
		document.body.style.userSelect = '';
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	export function show(): void { scrollableThumb.style.opacity = "1" }
    export function hide(): void { scrollableThumb.style.opacity = "0" }

    onMount(() => {
		window.addEventListener('resize', updateThumbPosition);
		setTimeout(updateThumbPosition, 100);
	});
</script>

<div class="scrollable-thumb-container">
	<div class="scrollable-thumb" bind:this={scrollableThumb} class:active={isDragging}></div>
</div>

<style lang="scss">
	.scrollable-thumb-container {
		position: absolute;
		top: 0;
		right: 0rem;
		width: 0.3rem;
		height: 100%;
		z-index: 5;

		.scrollable-thumb {
			position: absolute;
			width: 100%;
			background-color: #888;
			border-radius: 8px;
			opacity: 0;
			transition: opacity 0.1s ease-in-out;

			will-change: transform;

			&.active {
				// opacity: 1 !important;
			}
		}
	}
</style>
