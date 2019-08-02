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

	const conn = await new ConnectDB().connect();

	const result = await conn.query('SELECT * FROM gallery WHERE gid in (SELECT b.gid FROM tag AS a INNER JOIN gid_tid AS b ON a.id = b.tid WHERE a.name = ?) ORDER BY posted DESC LIMIT ? OFFSET ?', [tag, limit, (page - 1) * limit]);
	const gids = result.map(e => e.gid);

	const tags = await conn.query('SELECT a.gid, b.name FROM gid_tid AS a INNER JOIN tag AS b ON a.tid = b.id WHERE a.gid IN (?)', [gids]);
	const gidTags = {};
	tags.forEach(({ gid, name }) => {
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