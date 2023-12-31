const ConnectDB = require('../util/connectDB');
const getResponse = require('../util/getResponse');
const matchExec = require('../util/matchExec');
const { categoryMap } = require('../util/category');
const queryTags = require('../util/queryTags');
const queryTorrents = require('../util/queryTorrents');
const normalizedTag = require('../util/normalizedTag');

const search = async (req, res) => {
	let {
		keyword = '', category = '', expunged = 0, minpage = 0, maxpage = 0, minrating = 0,
		mindate = 0, maxdate = 0, removed = 0, replaced = 0, page = 1, limit = 10
	} = Object.assign({}, req.params, req.query);

	[page, limit] = [page, limit].map(e => e <= 0 ? 1 : parseInt(e, 10));
	[
		expunged, minpage, maxpage, minrating, mindate, maxdate
	] = [
		expunged, minpage, maxpage, minrating, mindate, maxdate
	].map(e => parseInt(e, 10));

	if (limit > 25) {
		return res.json(getResponse(null, 400, 'limit is too large'));
	}
	if (minrating > 5) {
		return res.json(getResponse(null, 400, 'min rating is too large'));
	}

	let cats = [];
	if (!Number.isNaN(+category)) {
		if (category < 0) {
			category = -category ^ 2047;
		}
		Object.entries(categoryMap).forEach(([key, value]) => {
			if (+key & +category) {
				cats.push(value);
			}
		});
	}
	else {
		cats = category.split(/\s*,\s*/).filter(e => e);
	}

	const getTargetValue = (input, to, { tag } = {}) => {
		let value = input.trim();
		if (tag) {
			value = value.replace(/"|\$/g, '').replace(/\*$/, '%');
		}

		const exclude = value[0] === '-';
		if (exclude) {
			value = value.substr(1);
		}

		let fullmatch = !tag || /\$"?$/.test(input);
		if (tag) {
			if (!fullmatch && !value.endsWith('%')) {
				value = `${value}%`;
			}
			if (tag && input.startsWith('tag:')) {
				fullmatch = false;
				value = value.replace(/^tag:/, '%:');
			}
			if (value.endsWith('%')) {
				fullmatch = false;
			}
		}

		let target = fullmatch ? to.inc : to.like;
		if (exclude) {
			value = value.substr(1);
			target = fullmatch ? to.exc : to.notLike;
		}
		return { target, value: normalizedTag(value) };
	};

	keyword = keyword.trim();

	const rawRootIds = matchExec(keyword, /(?:^|\s)(gid:("[\s\S]+?\$?"|.+?\$?))(?=\s|$)/g);
	const rootIds = { inc: [], exc: [] };
	keyword = rawRootIds.reduceRight((pre, cur) => {
		const { target, value } = getTargetValue(cur[1].replace(/"|\$/g, ''), rootIds);
		target.push(+value.split(':', 2)[1]);
		return pre.substr(0, cur.index) + pre.substr(cur.index + cur[0].length);
	}, keyword).trim();

	const rawUploader = matchExec(keyword, /(?:^|\s)(uploader:("[\s\S]+?\$?"|.+?\$?))(?=\s|$)/g);
	const uploader = { inc: [], exc: [], like: [], notLike: [] };
	keyword = rawUploader.reduceRight((pre, cur) => {
		const { target, value } = getTargetValue(cur[1], uploader, {
			tag: true
		});
		target.push(value.split(':', 2)[1]);
		return pre.substr(0, cur.index) + pre.substr(cur.index + cur[0].length);
	}, keyword).trim();

	const rawTags = matchExec(keyword, /(?:^|\s+)(\S*?:(?:"[\s\S]+?\$?"|[^"]+?\$?))(?=\s|$)/g);
	const tags = { inc: [], exc: [], like: [], notLike: [] };
	keyword = rawTags.reduceRight((pre, cur) => {
		const { target, value } = getTargetValue(cur[1], tags, {
			tag: true
		});
		target.push(value);
		return pre.substr(0, cur.index) + pre.substr(cur.index + cur[0].length);
	}, keyword).trim();

	const keywords = { inc: [], exc: [], like: [], notLike: [] };
	(keyword.match(/".+?"|[^\s]+/g) || []).forEach((e) => {
		const { target, value } = getTargetValue(e, keywords);
		target.push(value.replace(/^"|"$/g, ''));
	});

	const conn = await new ConnectDB().connect();

	let table;
	// prefer to get tag galleries first
	/* eslint-disable indent */
	if (tags.inc.length || tags.exc.length || tags.like.length || tags.notLike.length) {
		if (tags.inc.length || tags.like.length) {
			const inc = [...new Set(tags.inc)];
			const like = [...new Set(tags.like)];
			table = conn.connection.format(
				`(
					SELECT a.* FROM gid_tid AS a INNER JOIN (
						SELECT id FROM tag WHERE ${[
							inc.length && conn.connection.format('name IN (?)', [inc]),
							like.length && like.map(e => conn.connection.format('name LIKE ?', [e])).join(' OR ')
						].filter(e => e).join(' OR ')}
					) AS b ON a.tid = b.id GROUP BY a.gid HAVING COUNT(a.gid) >= ? ORDER BY NULL
				)`,
				// TODO: inc + like?
				[inc.length + like.reduce((pre, e) => {
					if (inc.some(i => i.includes(e.replace(/%/g, '')))) {
						return pre;
					}
					return pre + 1;
				}, 0)]
			);
		}
		let excTable;
		if (tags.exc.length || tags.notLike.length) {
			excTable = conn.connection.format(
				`(
					SELECT a.* FROM gid_tid AS a INNER JOIN (
						SELECT id FROM tag WHERE ${[
							tags.inc.length && conn.connection.format('name IN (?)', [tags.exc]),
							tags.like.length && tags.like.map(e => conn.connection.format('name LIKE ?', [e])).join(' OR ')
						].filter(e => e).join(' OR ')}
					) AS b ON a.tid = b.id
				)`
			);
			// if (table) {
			// 	table = `gallery LEFT JOIN ${excTable} AS t ON gallery.gid = t.gid WHERE t.gid IS NULL`;
			// }
			// else {
			// 	table = `(
			// 		SELECT a.* FROM gid_tid AS a LEFT JOIN ${excTable} AS b ON a.gid = b.gid WHERE b.gid IS NULL
			// 	)`;
			// }
		}
		if (excTable && !table) {
			table = `gallery LEFT JOIN ${excTable} AS t ON gallery.gid = t.gid`;
		}
		else {
			if (excTable) {
				table = `(
					SELECT a.* FROM ${table} AS a LEFT JOIN ${excTable} AS b ON a.gid = b.gid WHERE b.gid IS NULL
				)`;
			}
			table = `gallery FORCE INDEX(posted) INNER JOIN ${table} AS t ON gallery.gid = t.gid`;
		}
	}
	else {
		table = 'gallery';
	}
	/* eslint-enable indent */

	const query = [
		!expunged && 'expunged = 0',
		!removed && 'removed = 0',
		!replaced && 'replaced = 0',
		!tags.inc.length && tags.exc.length && 't.gid IS NULL',
		cats.length && cats.length !== 10 && conn.connection.format('category IN (?)', [cats]),
		// E-Hentai only returns the latest gallery of specific gid, but whatever, we have `replaced`
		rootIds.inc.length && conn.connection.format('root_gid IN (SELECT root_gid FROM gallery WHERE gid IN (?))', [rootIds.inc]),
		rootIds.exc.length && conn.connection.format('root_gid NOT IN (SELECT root_gid FROM gallery WHERE gid IN (?))', [rootIds.exc]),
		uploader.inc.length && conn.connection.format('uploader IN (?)', [uploader.inc]),
		uploader.exc.length && conn.connection.format('uploader NOT IN (?)', [uploader.exc]),
		minpage && conn.connection.format('filecount >= ?', [minpage]),
		maxpage && conn.connection.format('filecount <= ?', [maxpage]),
		minrating && minrating > 1 && conn.connection.format('rating >= ?', [minrating - 0.5]),
		mindate && conn.connection.format('posted >= ?', [mindate]),
		maxdate && conn.connection.format('posted <= ?', [maxdate]),
		// MariaDB can use `RLIKE '(?=keywordA)(?=keywordB)...'` to optimize the performance
		// but looks like MySQL 5+ doesn't support positive look ahead
		(keywords.inc.length || keywords.like.length) && [
			...keywords.inc.map(e => `%${e}%`),
			...keywords.like,
		].map(
			e => conn.connection.format('CONCAT_WS(\' \', title, title_jpn) LIKE ?', e)
		).join(' AND '),
		(keywords.exc.length || keywords.notLike.length) && [
			...keywords.exc.map(e => `%${e}%`),
			...keywords.notLike,
		].map(
			e => conn.connection.format('CONCAT_WS(\' \', title, title_jpn) NOT LIKE ?', e)
		).join(' AND '),
	].filter(e => e).join(' AND ');

	console.log(table, query, keywords);

	const result = await conn.query(
		`SELECT gallery.* FROM ${table} WHERE ${query || 1} ORDER BY gallery.posted DESC LIMIT ? OFFSET ?`,
		[limit, (page - 1) * limit]
	);

	const noForceIndexTable = table.replace('FORCE INDEX(posted)', '');
	const { total } = (await conn.query(`SELECT COUNT(*) AS total FROM ${noForceIndexTable} WHERE ${query || 1}`))[0];

	if (!result.length) {
		conn.destroy();
		return res.json(getResponse([], 200, 'success', { total }));
	}

	const gids = result.map(e => e.gid);
	const rootGids = result.map(e => e.root_gid).filter(e => e);
	const gidTags = await queryTags(conn, gids);
	const gidTorrents = await queryTorrents(conn, rootGids);

	result.forEach(e => {
		e.tags = gidTags[e.gid] || [];
		e.torrents = gidTorrents[e.root_gid] || [];
	});

	conn.destroy();
	return res.json(getResponse(result, 200, 'success', { total }));
};

module.exports = search;