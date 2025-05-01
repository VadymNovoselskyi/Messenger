export class PaginationService<T> {
	private lowerPage = $state<number>(1);
	private upperPage = $state<number>(1);
	private lowerLoadedPage = $state<number>(1);
	private upperLoadedPage = $state<number>(1);

	private _paginatedElements = $derived.by<T[]>(() => {
		this.elements;
		console.log('pages', this.lowerPage, this.upperPage);
		console.log('elements.length', this.elements.length);
		const start = Math.max((this.lowerLoadedPage - this.lowerPage) * this.pageSize, 0);
		const end = Math.min((this.upperPage - this.lowerPage + 1) * this.pageSize, this.elements.length);
		console.log('start', start, 'end', end);
		return this.elements.slice(start, end);
	});

	constructor(
		private elements: T[],
		private maxPages: number,
		private pageSize: number,
		private getter: (direction: 'UP' | 'DOWN', elements: T[]) => Promise<T[]>,
		private totalLength: number
	) {
		this.lowerPage = Math.ceil(this.totalLength / this.pageSize);
		this.upperPage = Math.ceil(this.totalLength / this.pageSize);
		this.lowerLoadedPage = this.lowerPage;
		this.upperLoadedPage = this.upperPage;
	}

	public get paginatedElements() {
		return this._paginatedElements;
	}

	public async changePage(direction: 'UP' | 'DOWN') {
		//UP (the sendTime is older)
		if (
			(this.lowerPage === this.lowerLoadedPage && direction === 'UP') ||
			(this.upperPage === this.upperLoadedPage && direction === 'DOWN')
		) {
			const newElements = await this.getter(direction, this.elements);
			if (!newElements.length) return;

			this.elements = [
				...(direction === 'DOWN' ? this.elements : []),
				...newElements,
				...(direction === 'UP' ? this.elements : [])
			];

			if (direction === 'UP') this.lowerLoadedPage = this.lowerPage - 1;
			else if (direction === 'DOWN') this.upperLoadedPage = this.upperPage + 1;
			// console.log(newElements.length, this.elements.length);
			// console.log(this.elements[0].sequence, this.elements[this.elements.length - 1].sequence);
		}
		if (this.upperPage - this.lowerPage < this.maxPages) {
			if (direction === 'UP') this.lowerPage -= 1;
			else if (direction === 'DOWN') this.upperPage += 1;
		} else {
			this.lowerPage += direction === 'DOWN' ? 1 : -1;
			this.upperPage += direction === 'DOWN' ? 1 : -1;
		}
	}
}
