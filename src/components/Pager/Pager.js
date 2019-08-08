import React from 'react';
import styles from './Pager.css';

const Pager = ({ page, total, onChange }) => {
	const pre = page - 1;
	const next = page + 1;
	let range;
	if (page <= 4) {
		range = new Array(Math.min(7, total)).fill('').map((e, i) => i + 1);
		if (total > 7) {
			if (total > 8) {
				range.push('...');
			}
			range.push(total);
		}
	}
	else if (page >= total - 3) {
		const min = total - 6;
		range = new Array(Math.min(7, total)).fill('').map((e, i) => total - i).reverse();
		if (min > 1) {
			if (min > 2) {
				range.unshift('...');
			}
			range.unshift(1);
		}
	}
	else {
		range = [1, '...', ...new Array(5).fill('').map((e, i) => page - 2 + i), '...', total];
	}

	return (
		<div className={styles.container}>
			<a
				className={page === 1 ? styles.disabled : ''}
				onClick={() => onChange(pre)}>
				&lt;
			</a>
			{range.map((e, i) => (
				<a
					className={[
						e === page ? styles.active : '',
						e === page ? styles.disabled : ''
					].join(' ')}
					disabled={e === page}
					onClick={() =>
						e === '...'
							? onChange(Math.min(Math.max(1, prompt(`Jump to: (1-${total})`) || page), total))
							: onChange(e)
					}
					key={i}>
					{e}
				</a>
			))}
			<a
				className={page === total ? styles.disabled : ''}
				onClick={() => onChange(next)}>
				&gt;
			</a>
		</div>
	);
};

export default Pager;