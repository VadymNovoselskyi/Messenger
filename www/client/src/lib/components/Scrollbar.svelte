<script lang="ts">
	import { onMount } from 'svelte';
	let {
		scrollableContent,
		width,
		lastScroll = $bindable()
	}: {
		scrollableContent: HTMLElement;
		width: number;
		lastScroll?: number;
	} = $props();

	let scrollableThumb: HTMLElement;
	let isDragging = $state(false);
	let startY = 0;
	let lastY = 0;
	let startScrollTop = 0;
	let animationFrameId: number | null;

	export function updateThumbPosition(): void {
		// If there's already a scheduled frame, cancel it.
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
		}
		if(!scrollableContent) requestAnimationFrame(updateThumbPosition);

		animationFrameId = requestAnimationFrame(() => {
			const contentHeight = scrollableContent.scrollHeight;
			const visibleHeight = scrollableContent.clientHeight;
			const scrollTop = scrollableContent.scrollTop;
			if (lastScroll !== undefined) lastScroll = scrollTop;

			// Calculate thumb height proportionally, but not less than 20px.
			const computedThumbHeight = (visibleHeight / contentHeight) * visibleHeight;
			const thumbHeight = Math.max(computedThumbHeight, 40);

			// The track is the area available for the thumb to move.
			const trackHeight = visibleHeight - thumbHeight;
			const maxScrollTop = contentHeight - visibleHeight;
			// Calculate the thumb's position relative to the scrollable content.
			const relativeThumbPosition = (scrollTop / maxScrollTop) * trackHeight;

			const containerRect = scrollableContent.getBoundingClientRect();
			// The final thumb position is the offset plus the relative movement.
			const thumbPosition = relativeThumbPosition + containerRect.top;

			scrollableThumb.style.height = `${thumbHeight}px`;
			scrollableThumb.style.transform = `translateY(${thumbPosition}px)`;

			// Clear the frame id after the frame has executed.
			animationFrameId = null;
		});
	}

	export function onMouseDown(event?: MouseEvent): void {
		isDragging = true;
		startY = event?.clientY || lastY;
		startScrollTop = scrollableContent.scrollTop;

		// Disable text selection while dragging.
		document.body.style.userSelect = 'none';

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	export function onMouseUp(): void {
		isDragging = false;

		// Re-enable text selection.
		document.body.style.userSelect = '';
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	export function onMouseMove(event: MouseEvent): void {
		if (!isDragging) return;
		const deltaY = event.clientY - startY;
		lastY = event.clientY;
		const contentHeight = scrollableContent.scrollHeight;
		const visibleHeight = scrollableContent.clientHeight;

		const computedThumbHeight = (visibleHeight / contentHeight) * visibleHeight;
		const thumbHeight = Math.max(computedThumbHeight, 20);

		const trackHeight = visibleHeight - thumbHeight;
		const maxScrollTop = contentHeight - visibleHeight;
		const scrollRatio = maxScrollTop / trackHeight;

		// Compute new scrollTop and ensure it doesn't exceed bounds.
		let newScrollTop = startScrollTop + deltaY * scrollRatio;
		newScrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));
		scrollableContent.scrollTop = newScrollTop;

		updateThumbPosition();
	}

	export function show(): void {
		scrollableThumb.style.backgroundColor = 'rgba(43, 43, 43, 0.8)';
	}
	export function hide(): void {
		scrollableThumb.style.backgroundColor = 'rgba(90, 90, 90, 0.7)';
	}
	export function isDraggingOn(): boolean {
		return isDragging;
	}

	onMount(() => {
		window.addEventListener('resize', updateThumbPosition);
		setTimeout(updateThumbPosition, 100);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="scrollable-thumb-container" style={`width: ${width}rem`}>
	<div
		class="scrollable-thumb"
		bind:this={scrollableThumb}
		class:active={isDragging}
		onmousedown={onMouseDown}
		onmouseup={onMouseUp}
	></div>
</div>

<style lang="scss">
	.scrollable-thumb-container {
		position: absolute;
		top: 0;
		right: 0rem;
		height: 100%;
		z-index: 5;

		.scrollable-thumb {
			position: absolute;
			width: 100%;
			background-color: rgba(90, 90, 90, 0.7);
			border-radius: 8px;
			transition: opacity 0.1s ease-in-out;

			will-change: transform;

			&.active,
			&:hover {
				background-color: rgba(43, 43, 43, 0.8) !important;
			}
		}
	}
</style>
