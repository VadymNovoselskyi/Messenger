export class PaginationService<T> {
	private _elements = $state<T[]>([]);
	private _currentPage = $state(1);
	private _paginatedElements = $derived.by<T[]>(() => {
		const start = (this.currentPage - 1) * this.pageSize;
		return this.elements.slice(start, start + this.pageSize);
	});

	constructor(
		elements: T[],
		private maxPages: number,
		private pageSize: number,
		private getter: (direction: 'UP' | 'DOWN', elements: T[]) => Promise<T[]>
	) {
		this._elements.push(...elements);
	}

	public get paginatedElements() {
		return this._paginatedElements;
	}

	public get elements() {
		return this._elements;
	}

	public get currentPage() {
		return this._currentPage;
	}

	public changePage(direction: 'UP' | 'DOWN') {
		this._currentPage += direction === 'UP' ? 1 : -1;
		if (
			this.currentPage < 1 ||
			this.currentPage > Math.ceil(this.elements.length / this.pageSize)
		) {
			this.getter(direction, this.elements);
		}
	}
}
