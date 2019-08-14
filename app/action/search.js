const ConnectDB = require('../util/connectDB');
const getResponse = require('../util/getResponse');
const matchExec = require('../util/matchExec');
const { categoryMap } = require('../util/category');

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
			category = -category ^ 1023;
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

	const getTargetValue = (input, to) => {
		let value = input;
		let target = to.inc;
		if (value[0] === '-') {
			value = value.substr(1);
			target = to.exc;
		}
		return { target, value };
	};

	const rawUploader = matchExec(keyword, /(?:^|\s)(uploader:(.+?))(?=\s|$)/g);
	const uploader = { inc: [], exc: [] };
	keyword = rawUploader.reduceRight((pre, cur) => {
		const { target, value } = getTargetValue(cur[1], uploader);
		target.unshift(value.split(':', 2)[1]);
		return pre.substr(0, cur.index) + pre.substr(cur.index + cur[0].length);
	}, keyword);

	const rawTags = matchExec(keyword, /(?:^|\s)(\S*?:?(?:"[\s\S]+?\$"|.+?\$))(?=\s|$)/g);
	const tags = { inc: [], exc: [] };
	keyword = rawTags.reduceRight((pre, cur) => {
		const { target, value } = getTargetValue(cur[1].replace(/"|\$/g, ''), tags);
		target.unshift(value);
		return pre.substr(0, cur.index) + pre.substr(cur.index + cur[0].length);
	}, keyword);

	const keywords = { inc: [], exc: [] };
	(keyword.match(/".+?"|[^\s]+/g) || []).forEach((e) => {
		const { target, value } = getTargetValue(e, keywords);
		target.push(value.replace(/^"|"$/g, ''));
	});

	const conn = await new ConnectDB().connect();

	let table;
	// prefer to get tag galleries first
	if (tags.inc.length || tags.exc.length) {
		if (tags.inc.length) {
			table = conn.connection.format(
				`(
					SELECT a.* FROM gid_tid AS a INNER JOIN (
						SELECT id FROM tag WHERE name IN (?)
					) AS b ON a.tid = b.id GROUP BY a.gid HAVING COUNT(a.gid) = ? ORDER BY NULL
				)`,
				[tags.inc, tags.inc.length]
			);
		}
		let excTable;
		if (tags.exc.length) {
			excTable = conn.connection.format(
				`(
					SELECT a.* FROM gid_tid AS a INNER JOIN (
						SELECT id FROM tag WHERE name IN (?)
					) AS b ON a.tid = b.id
				)`,
				[tags.exc]
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
			table = `gallery INNER JOIN ${table} AS t ON gallery.gid = t.gid`;
		}
	}
	else {
		table = 'gallery';
	}

	const query = [
		!expunged && 'expunged = 0',
		!removed && 'removed = 0',
		!replaced && 'replaced = 0',
		!tags.inc.length && tags.exc.length && 't.gid IS NULL',
		cats.length && cats.length !== 10 && conn.connection.format('category IN (?)', [cats]),
		uploader.inc.length && conn.connection.format('uploader IN (?)', [uploader.inc]),
		uploader.exc.length && conn.connection.format('uploader NOT IN (?)', [uploader.exc]),
		minpage && conn.connection.format('filecount >= ?', [minpage]),
		maxpage && conn.connection.format('filecount <= ?', [maxpage]),
		minrating && minrating > 1 && conn.connection.format('rating >= ?', [minrating - 0.5]),
		mindate && conn.connection.format('posted >= ?', [mindate]),
		maxdate && conn.connection.format('posted <= ?', [maxdate]),
		// MariaDB can use `RLIKE '(?=keywordA)(?=keywordB)...'` to optimize the performance
		// but looks like MySQL 5+ doesn't support positive look ahead
		keywords.inc.length && keywords.inc.map(
			e => conn.connection.format('CONCAT_WS(\' \', title, title_jpn) LIKE ?', `%${e}%`)
		).join(' AND '),
		keywords.exc.length && keywords.exc.map(
			e => conn.connection.format('CONCAT_WS(\' \', title, title_jpn) NOT LIKE ?', `%${e}%`)
		).join(' AND '),
	].filter(e => e).join(' AND ');

	const result = await conn.query(
		`SELECT gallery.* FROM ${table} WHERE ${query || 1} ORDER BY gallery.posted DESC LIMIT ? OFFSET ?`,
		[limit, (page - 1) * limit]
	);

	const { total } = (await conn.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${query || 1}`))[0];

	if (!result.length) {
		conn.destroy();
		return res.json(getResponse([], 200, 'success', { total }));
	}
	const gids = result.map(e => e.gid);

	const tagResult = await conn.query(
		'SELECT a.gid, b.name FROM gid_tid AS a INNER JOIN tag AS b ON a.tid = b.id WHERE a.gid IN (?)', [gids]
	);
	const gidTags = {};
	tagResult.forEach(({ gid, name }) => {
		if (!gidTags[gid]) {
			gidTags[gid] = [];
		}
		gidTags[gid].push(name);
	});
	result.forEach(e => {
		e.tags = gidTags[e.gid] || [];
	});

	conn.destroy();
	return res.json(getResponse(result, 200, 'success', { total }));
};

module.exports = search;