export class PaginationService<T> {
	private lowerPage = $state<number>(1);
	private upperPage = $state<number>(1);
	private lowerLoadedPage = $state<number>(1);
	private upperLoadedPage = $state<number>(1);

	private start = $derived.by(() => {
		return Math.max((this.lowerPage - this.lowerLoadedPage) * this.pageSize, 0);
	});
	private end = $derived.by(() => {
		return Math.min(
			this.elements.length - (this.upperLoadedPage - this.upperPage) * this.pageSize,
			this.elements.length
		);
	});
	private _paginatedElements = $derived.by<T[]>(() => {
		if (this.elements.length <= this.maxPages * this.pageSize) return this.elements;
		return this.elements.slice(this.start, this.end);
	});

	constructor(
		private elements: T[],
		private maxPages: number,
		private pageSize: number,
		private getter: (direction: 'UP' | 'DOWN', elements: T[]) => Promise<T[]>,
		private _totalLength: number
	) {
		const totalPages = Math.ceil(this._totalLength / this.pageSize);
		this.lowerPage = totalPages;
		this.upperPage = totalPages;
		this.lowerLoadedPage = totalPages;
		this.upperLoadedPage = totalPages;
	}

	public get paginatedElements() {
		return this._paginatedElements;
	}

	public async changePage(direction: 'UP' | 'DOWN') {
		if (
			(this.lowerPage === this.lowerLoadedPage && direction === 'UP') ||
			(this.upperPage === this.upperLoadedPage && direction === 'DOWN')
		) {
			const newElements = await this.getter(direction, this.elements);
			if (!newElements.length) return;

			if (direction === 'UP') {
				this.elements.unshift(...newElements);
				this.lowerLoadedPage = this.lowerPage - 1;
			} else {
				this.elements.push(...newElements);
				this.upperLoadedPage = this.upperPage + 1;
			}
		}
		if (this.upperPage - this.lowerPage < this.maxPages - 1) {
			if (direction === 'UP') this.lowerPage -= 1;
			else if (direction === 'DOWN') this.upperPage += 1;
		} else {
			this.lowerPage += direction === 'DOWN' ? 1 : -1;
			this.upperPage += direction === 'DOWN' ? 1 : -1;
		}
	}

	public set totalLength(length: number) {
		this._totalLength = length;

		if (this._totalLength > this.upperLoadedPage * this.pageSize) {
			this.upperLoadedPage = Math.ceil(this._totalLength / this.pageSize);
		}
	}
}
