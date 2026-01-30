<script lang="ts">
	interface Props {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
	}

	let { currentPage, totalPages, onPageChange }: Props = $props();

	const getPageNumbers = () => {
		const pages: (number | string)[] = [];
		const maxVisible = 7;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			if (currentPage <= 4) {
				for (let i = 1; i <= 5; i++) {
					pages.push(i);
				}
				pages.push('...');
				pages.push(totalPages);
			} else if (currentPage >= totalPages - 3) {
				pages.push(1);
				pages.push('...');
				for (let i = totalPages - 4; i <= totalPages; i++) {
					pages.push(i);
				}
			} else {
				pages.push(1);
				pages.push('...');
				for (let i = currentPage - 1; i <= currentPage + 1; i++) {
					pages.push(i);
				}
				pages.push('...');
				pages.push(totalPages);
			}
		}

		return pages;
	};

	const handlePageClick = (page: number | string) => {
		if (typeof page === 'number' && page !== currentPage) {
			onPageChange(page);
		}
	};

	const handlePrevious = () => {
		if (currentPage > 1) {
			onPageChange(currentPage - 1);
		}
	};

	const handleNext = () => {
		if (currentPage < totalPages) {
			onPageChange(currentPage + 1);
		}
	};
</script>

{#if totalPages > 1}
	<nav class="flex items-center justify-center gap-2">
		<button
			onclick={handlePrevious}
			disabled={currentPage === 1}
			class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
			type="button"
		>
			Previous
		</button>

		<div class="flex gap-1">
			{#each getPageNumbers() as page}
				{#if page === '...'}
					<span class="px-3 py-2 text-gray-400">...</span>
				{:else}
					<button
						onclick={() => handlePageClick(page)}
						class="px-3 py-2 rounded-md text-sm font-medium transition-colors {page === currentPage
							? 'bg-blue-600 text-white'
							: 'text-gray-700 hover:bg-gray-100'}"
						type="button"
					>
						{page}
					</button>
				{/if}
			{/each}
		</div>

		<button
			onclick={handleNext}
			disabled={currentPage === totalPages}
			class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
			type="button"
		>
			Next
		</button>
	</nav>
{/if}
