const ConnectDB = require('../util/connectDB');
const getResponse = require('../util/getResponse');
const matchExec = require('../util/matchExec');
const { categoryMap } = require('../util/category');

const search = async (req, res) => {
	let {
		keyword = '', category = '', expunged = 0, minpage = 0, maxpage = 0, minrating = 0, page = 1, limit = 10
	} = Object.assign({}, req.params, req.query);

	[page, limit] = [page, limit].map(e => e <= 0 ? 1 : parseInt(e, 10));
	[expunged, minpage, maxpage, minrating] = [expunged, minpage, maxpage, minrating].map(e => parseInt(e, 10));
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

	const rawUploader = matchExec(keyword, /(?:^|\s)(uploader:(.+?))(?=\s|$)/g);
	const uploader = [];
	keyword = rawUploader.reduceRight((pre, cur) => {
		uploader.unshift(cur[1]);
		return pre.substr(0, cur.index) + pre.substr(cur.index + cur[0].length);
	}, keyword);

	const rawTags = matchExec(keyword, /(?:^|\s)(\S+?:(?:"[\s\S]+?\$"|.+?\$))(?=\s|$)/g);
	const tags = [];
	keyword = rawTags.reduceRight((pre, cur) => {
		tags.unshift(cur[1].replace(/"|\$/g, ''));
		return pre.substr(0, cur.index) + pre.substr(cur.index + cur[0].length);
	}, keyword);

	const keywords = (keyword.match(/".+?"|[^\s]+/g) || []).map(e => e.replace(/^"|"$/g, ''));

	const conn = await new ConnectDB().connect();

	let table;
	if (tags.length) {
		// prefer to get tag galleries first
		table = conn.connection.format(
			`gallery INNER JOIN (
				SELECT a.*, COUNT(a.gid) AS count FROM gid_tid AS a INNER JOIN (
					SELECT id FROM tag WHERE name IN (?)
				) AS b ON a.tid = b.id GROUP BY a.gid HAVING count = ? ORDER BY NULL
			) AS t ON gallery.gid = t.gid`,
			[tags, tags.length]
		);
	}
	else {
		table = 'gallery';
	}

	const query = [
		!expunged && 'expunged = 0',
		cats.length && conn.connection.format('category IN (?)', [cats]),
		uploader.length && conn.connection.format('uploader IN (?)', [uploader]),
		minpage && conn.connection.format('filecount >= ?', [minpage]),
		maxpage && conn.connection.format('filecount <= ?', [maxpage]),
		minrating && conn.connection.format('rating >= ?', [minrating - 0.5]),
		// MariaDB can use `RLIKE '(?=keywordA)(?=keywordB)...'` to optimize the performance
		// but looks like MySQL 5+ doesn't support positive look ahead
		keywords.length && keywords.map(
			e => conn.connection.format('CONCAT_WS(\' \', title, title_jpn) LIKE ?', `%${e}%`)
		).join(' AND ')
	].filter(e => e).join(' AND ');

	const result = await conn.query(
		`SELECT gallery.* FROM ${table}
			WHERE ${query} ORDER BY posted DESC LIMIT ? OFFSET ?`,
		[limit, (page - 1) * limit]
	);
	const gids = result.map(e => e.gid);
	if (!gids.length) {
		conn.destroy();
		return res.json(getResponse([], 200, 'success'));
	}

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
		delete e.concat_title;
		e.tags = gidTags[e.gid] || [];
	});

	conn.destroy();
	return res.json(getResponse(result, 200, 'success'));
};

module.exports = search;