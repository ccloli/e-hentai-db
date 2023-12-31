import React, { useState, useEffect, useRef } from 'react';
import queryString from 'querystring';
import SearchBox from '../SearchBox';
import List from '../List';
import styles from './Home.css';
import Pager from '../Pager';

const Home = ({ history }) => {
	const [list, setList] = useState([]);
	const [loading, setLoading] = useState(false);
	const [total, setTotal] = useState(null);
	const aborter = useRef();
	const totalStatus = useRef();

	const query = queryString.parse(history.location.search.substr(1));
	const { page = 1, limit = 10 } = query;
	const totalPage = Math.ceil(total / limit);

	const getList = () => {
		setLoading(true);
		if (aborter.current) {
			aborter.current.abort();
		}

		const abort = new AbortController();
		aborter.current = abort;
		const { signal } = abort;

		fetch(`/api/search${history.location.search}`, { signal }).then(res => res.json()).then((res) => {
			const { data, total } = res;
			aborter.current = null;
			setList(data);
			setTotal(total);
			setLoading(false);
			if (totalStatus.current) {
				totalStatus.current.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
				});
			}
		});
	};

	const onSearch = (options) => {
		const sortedOptions = Object.keys(options).sort().reduce((pre, cur) => {
			if (options[cur]) {
				pre[cur] = options[cur];
			}
			return pre;
		}, {});
		history.push(`/?${queryString.stringify(sortedOptions)}`);
	};

	const setPage = (page) => {
		onSearch({ ...query, page });
	};

	const onGallerySearch = (options, { append } = {}) => {
		const { category, expunged, minpage, maxpage, minrating, advance } = query;
		const data = {
			...query, category, expunged, minpage, maxpage, minrating, limit, advance
		};
		Object.keys(options).forEach((cur) => {
			if (append) {
				if (cur === 'keyword' && options[cur].startsWith('uploader:') && data[cur]) {
					data[cur] = data[cur].replace(/\s*uploader:(?:"[\s\S]+?\$"|.+?\$)/, '');
				}
				data[cur] = [data[cur], options[cur]].filter(e => e).join(' ');
			}
			else {
				data[cur] = options[cur];
			}
		}, {});
		onSearch(data);
	};

	useEffect(getList, [history.location.search]);

	return (
		<div className={styles.container}>
			<SearchBox options={query} search={history.location.search} onSearch={onSearch} />
			<p className={styles.total} ref={totalStatus}>
				{loading ? 'Loading...' : `Matches ${total} ${total > 1 ? 'results' : 'result'}.`}
			</p>
			{list.length ? (
				<>
					<Pager page={+page} total={totalPage} onChange={setPage} />
					<List list={list} loading={loading} onSearch={onGallerySearch} />
					<Pager page={+page} total={totalPage} onChange={setPage} />
				</>
			) : null}
		</div>
	);
};

export default Home;