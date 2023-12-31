import React, { useState } from 'react';
import moment from 'moment';
import { withRouter } from 'react-router-dom';
import fileSize from '../../util/fileSize';
import styles from './Gallery.css';
import { categoryNameMap } from '../../util/category';
import Rating from '../Rating';
import parseEntity from '../../util/parseEntity';
import Modal from '../Modal/Modal';
import Torrent from '../Torrent';

const Gallery = ({
	thumb, category, uploader, posted, expunged, removed, replaced, filesize, filecount,
	title, title_jpn, rating, tags = [], gid, token, torrents, onSearch = () => {}
}) => {
	const [visible, setVisible] = useState(false);
	const toggleTorrentModal = () => setVisible(!visible);

	const tagList = {};
	tags.forEach(e => {
		const [type, name] = ['misc'].concat(e.split(':', 2)).slice(-2);
		if (!tagList[type]) {
			tagList[type] = [];
		}
		tagList[type].push(name);
	});

	return (
		<div className={styles.container}>
			<div className={styles.coverWrap}>
				<img src={thumb.replace(/_l\./, '_250.')} className={styles.cover} />
			</div>
			<div className={styles.meta}>
				<div className={styles.metaSingleItem}>
					<div
						className={styles.category}
						style={{ background: categoryNameMap[category].color }}
						onClick={() => onSearch({ category: categoryNameMap[category].value })}>
						{category}
					</div>
				</div>
				<div className={styles.metaSingleItem}>
					<a
						onClick={(event) => onSearch({
							keyword: `uploader:${/\s/.test(uploader) ? `"${uploader}$"` : `${uploader}$`}`
						}, {
							append: event.ctrlKey,
						})}>
						{uploader}
					</a>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>Gallery ID:</span>
					<span className={styles.metaValue}>
						{gid}
					</span>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>Token:</span>
					<span className={styles.metaValue}>
						{token}
					</span>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>Posted:</span>
					<span className={styles.metaValue}>
						{moment(posted * 1000).format('YYYY-MM-DD HH:mm:ss')}
					</span>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>Visible:</span>
					<span className={styles.metaValue}>
						{
							expunged ? 'No (Expunged)'
								: removed ? 'No (Removed)'
									: replaced ? 'No (Replaced)'
										: category.toLowerCase() === 'private' ? 'No (Private)'
											: 'Yes'
						}
					</span>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>File Size:</span>
					<span className={styles.metaValue}>
						{fileSize(filesize)}
					</span>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>File Length:</span>
					<span className={styles.metaValue}>
						{filecount}
						{' '}
						{filecount > 1 ? 'pages' : 'page'}
					</span>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>Torrents:</span>
					<span className={styles.metaValue}>
						<a
							className={styles.torrentLink}
							onClick={torrents.length ? toggleTorrentModal : null}
							disabled={!torrents.length}>
							{torrents.length}
						</a>
					</span>
				</div>
				<div className={styles.metaItem}>
					<span className={styles.metaLabel}>Rating:</span>
					<span className={styles.metaValue}>
						<Rating value={rating} />
						{rating}
					</span>
				</div>
			</div>
			<div className={styles.main}>
				<div className={styles.header}>
					<h2 className={styles.title}>
						{parseEntity(title)}
					</h2>
					<h3 className={styles.subtitle}>
						{parseEntity(title_jpn)}
					</h3>
				</div>
				<div className={styles.tags}>
					{Object.entries(tagList).map(([type, list]) => (
						<div className={styles.tagLine} key={type}>
							<div className={styles.tagType}>{type}:</div>
							<div className={styles.tagList}>
								{list.map(tag => (
									<a
										key={tag}
										onClick={(event) => onSearch({
											keyword: `${type === 'misc' ? '' : `${type}:`}${/\s/.test(tag) ? `"${tag}$"` : `${tag}$`}`
										}, {
											append: event.ctrlKey,
										})}>
										{tag}
									</a>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
			<Modal visible={visible} onClose={toggleTorrentModal}>
				<Torrent torrents={torrents} />
			</Modal>
		</div>
	);
};

export default withRouter(Gallery);