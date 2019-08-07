import React, { useState, useEffect } from 'react';
import categoryList from '../../util/category';
import styles from './SearchBox.css';

const SearchBox = ({ options, onSearch }) => {
	const [category, setCategory] = useState(+options.category || 1023);
	const [keyword, setKeyword] = useState(options.keyword || '');
	const [expunged, setExpunged] = useState(+options.expunged || 0);
	const [minpage, setMinPage] = useState(options.minpage || '');
	const [maxpage, setMaxPage] = useState(options.maxpage || '');
	const [minrating, setMinRating] = useState(options.minrating || '');
	const [limit, setLimit] = useState(options.limit || 10);
	const [showAdvance, setShowAdvance] = useState(+options.advance || 0);

	const updateCategory = (event) => {
		const value = +event.target.value;
		setCategory(category + (event.target.checked ? value : -value));
	};

	const updateKeyword = (event) => {
		setKeyword(event.target.value);
	};

	const updateExpunged = (event) => {
		setExpunged(+event.target.checked);
	};

	const updateMinRating = (event) => {
		setMinRating(+event.target.value);
	};

	const updateMinPage = (event) => {
		setMinPage(+event.target.value);
	};

	const updateMaxPage = (event) => {
		setMaxPage(+event.target.value);
	};

	const updateLimit = (event) => {
		setLimit(+event.target.value);
	};

	const toggleAdvance = () => {
		setShowAdvance(!showAdvance);
	};

	const onSubmit = (event) => {
		event.preventDefault();
		if (onSearch) {
			onSearch({
				category,
				keyword,
				expunged,
				minpage,
				maxpage,
				minrating,
				limit,
				advance: +showAdvance,
			});
		}
	};
	
	useEffect(() => {
		setCategory(+options.category || 1023);
		setKeyword(options.keyword || '');
		setExpunged(+options.expunged || 0);
		setMinPage(options.minpage || '');
		setMaxPage(options.maxpage || '');
		setMinRating(options.minrating || '');
		setLimit(options.limit || 10);
		setShowAdvance(+options.advance || 0);
	}, [options]);

	return (
		<form className={styles.container} onSubmit={onSubmit}>
			<div className={styles.category}>
				{categoryList.map(e => (
					<label key={e.value} className={styles.item}>
						<input type="checkbox" checked={category & e.value} value={e.value} onChange={updateCategory} className={styles.checkbox} />
						<span className={styles.name} style={{ background: e.color }}>{e.name}</span>
					</label>
				))}
			</div>
			<div className={styles.search}>
				<input value={keyword} onInput={updateKeyword} className={styles.input} />
				<button className={styles.button}>Search</button>
			</div>
			<div className={styles.toggle}>
				<a onClick={toggleAdvance}>
					{showAdvance ? 'Hide Advanced Options' : 'Show Advanced Options'}
				</a>
			</div>
			{showAdvance ? (
				<div className={styles.advance}>
					<label className={styles.advanceItem}>
						<input type="checkbox" checked={expunged} onChange={updateExpunged} />
						Show Expunged
					</label>
					<label className={styles.advanceItem}>
						Show
						<select value={limit} onChange={updateLimit} className={styles.select}>
							{(new Array(5).fill('')).map((e, i) => (
								<option value={(i + 1) * 5} key={i}>{(i + 1) * 5}</option>
							))}
						</select>
						galleries per page
					</label>
					<label className={styles.advanceItem}>
						Minimum Rating
						<select value={minrating} onChange={updateMinRating} className={styles.select}>
							{(new Array(5).fill('')).map((e, i) => (
								<option value={i + 1} key={i}>{i + 1}</option>
							))}
						</select>
					</label>
					<label className={styles.advanceItem}>
						Between
						<input type="number" className={styles.inputNumber} value={minpage} onChange={updateMinPage} />
						and
						<input type="number" className={styles.inputNumber} value={maxpage} onChange={updateMaxPage} />
						pages
					</label>
				</div>
			) : null}
		</form>
	);
};

SearchBox.defaultProps = {
	options: {}
};

export default SearchBox;