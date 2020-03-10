import React from 'react';
import styles from './Torrent.css';
import moment from 'moment';

const Torrent = ({ torrents }) => (
	<table className={styles.table}>
		<colgroup>
			<col style={{ width: '90px' }} />
			<col />
			<col style={{ width: '100px' }} />
			<col style={{ width: '150px' }} />
			<col style={{ width: '130px' }} />
		</colgroup>
		<thead className={styles.thead}>
			<tr>
				<th>Torrent ID</th>
				<th>File Name</th>
				<th>File Size</th>
				<th>Uploader</th>
				<th>Upload Date</th>
			</tr>
		</thead>
		<tbody>
			{torrents.map(e => (
				<tr key={e.id || e.hash}>
					<td>{e.id}</td>
					<td>
						<a href={`magnet:?xt=urn:btih:${e.hash}`}>{e.name}</a>
					</td>
					<td>{e.fsizestr}</td>
					<td>{e.uploader}</td>
					<td>{e.addedstr && moment(`${e.addedstr}+00:00`).format('YYYY-MM-DD HH:mm')}</td>
				</tr>
			))}
		</tbody>
	</table>
);

export default Torrent;