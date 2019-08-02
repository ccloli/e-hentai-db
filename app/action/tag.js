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

	const result = await conn.query(
		`SELECT a.* FROM gallery AS a INNER JOIN (
			SELECT a.*, COUNT(a.gid) AS count FROM gid_tid AS a INNER JOIN (
				SELECT id FROM tag WHERE name IN (?)
			) AS b ON a.tid = b.id GROUP BY a.gid HAVING count = ? ORDER BY NULL
		) AS b ON a.gid = b.gid ORDER BY posted DESC LIMIT ? OFFSET ?`,
		[tags, tags.length, limit, (page - 1) * limit]
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
		e.tags = gidTags[e.gid] || [];
	});

	conn.destroy();
	return res.json(getResponse(result, 200, 'success'));
};

module.exports = tagList;