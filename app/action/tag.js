const ConnectDB = require('../util/connectDB');
const getResponse = require('../util/getResponse');

const tagList = async (req, res) => {
	let { tag, page = 1, limit = 10 } = Object.assign({}, req.params, req.query);
	[page, limit] = [page, limit].map(e => {
		if (e <= 0) {
			return 1;
		}
		return parseInt(e, 10);
	});
	if (limit > 25) {
		return res.json(getResponse(null, 400, 'limit is too large'));
	}

	const tags = tag.split(/\s*,\s*/).filter(e => e);
	if (!tags.length) {
		return res.json(getResponse(null, 400, 'tag is not defined'));
	}

	const conn = await new ConnectDB().connect();
	// const tidResult = await conn.query('SELECT id FROM tag WHERE name IN (?)', [tags]);
	// const tids = tidResult.map(e => e.id);
	// const query = tids.reduce((table, id) => {
	// 	if (!table) {
	// 		table = 'gid_tid';
	// 	}
	// 	else {
	// 		table = `(SELECT b.* FROM ${table} AS a LEFT JOIN gid_tid AS b ON a.gid = b.gid)`;
	// 	}
	// 	return conn.connection.format(`(SELECT gid FROM ${table} AS t WHERE tid = ?)`, [id])
	// }, '');
	// console.log(query);

	// const result = await conn.query(
	// 	`SELECT * FROM gallery WHERE gid IN (
	// 		SELECT DISTINCT gid FROM (
	// 			SELECT gid, COUNT(1) AS count FROM gid_tid WHERE tid IN (
	// 				SELECT id FROM tag WHERE name IN (?)
	// 			) GROUP BY gid HAVING count = ? ORDER BY NULL
	// 		) AS t
	// 	) ORDER BY posted DESC LIMIT ? OFFSET ?`,
	// 	[tags, tags.length, limit, (page - 1) * limit]
	// );
	// console.log(result);
	// const gids = result.map(e => e.gid);

	const result = await conn.query(
		`SELECT a.* FROM gallery AS a INNER JOIN (
			SELECT a.*, COUNT(a.gid) AS count FROM gid_tid AS a INNER JOIN (
				SELECT id FROM tag WHERE name IN (?)
			) AS b ON a.tid = b.id GROUP BY a.gid HAVING count = ? ORDER BY NULL
		) AS b ON a.gid = b.gid ORDER BY posted DESC LIMIT ? OFFSET ?`,
		[tags, tags.length, limit, (page - 1) * limit]
	);
	const gids = result.map(e => e.gid);

	// const preResult = await conn.query(
	// 	'SELECT b.gid, a.name, COUNT(b.gid) AS count FROM (SELECT * FROM tag WHERE name IN (?)) AS a INNER JOIN gid_tid AS b ON a.id = b.tid',
	// 	[tags]
	// );
	// console.log(preResult);
	// const gidMaps = {};
	// const tagMaps = tags.reduce((pre, e) => {
	// 	pre[e] = 1;
	// 	return pre;
	// }, {});
	// const tagLength = tags.length;
	// preResult.forEach(({ gid, name }) => {
	// 	if (tagMaps[name]) {
	// 		gidMaps[gid] = (gidMaps[gid] || 0) + 1;
	// 	}
	// });
	// const preGids = Object.entries(gidMaps).filter(([key, value]) => value === tagLength).map(e => +e[0]);

	// const result = await conn.query(
	// 	`SELECT * FROM gallery WHERE gid IN (?) ORDER BY posted DESC LIMIT ? OFFSET ?`,
	// 	[preGids, limit, (page - 1) * limit]
	// );
	// console.log(result);
	// const gids = result.map(e => e.gid);

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
	return res.json(getResponse(result, 200, 'success'));
};

module.exports = tagList;