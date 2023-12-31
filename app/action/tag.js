const ConnectDB = require('../util/connectDB');
const getResponse = require('../util/getResponse');
const queryTags = require('../util/queryTags');
const queryTorrents = require('../util/queryTorrents');
const normalizedTag = require('../util/normalizedTag');

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

	const tags = tag.split(/\s*,\s*/).filter(e => e).map(normalizedTag);
	if (!tags.length) {
		return res.json(getResponse(null, 400, 'tag is not defined'));
	}

	const conn = await new ConnectDB().connect();

	const result = await conn.query(
		`SELECT a.* FROM gallery AS a FORCE INDEX(posted) INNER JOIN (
			SELECT a.* FROM gid_tid AS a INNER JOIN (
				SELECT id FROM tag WHERE name IN (?)
			) AS b ON a.tid = b.id GROUP BY a.gid HAVING COUNT(a.gid) = ? ORDER BY NULL
		) AS b ON a.gid = b.gid WHERE expunged = 0 ORDER BY posted DESC LIMIT ? OFFSET ?`,
		[tags, tags.length, limit, (page - 1) * limit]
	);
	const { total } = (await conn.query(
		`SELECT COUNT(*) AS total FROM gallery AS a INNER JOIN (
			SELECT a.* FROM gid_tid AS a INNER JOIN(
				SELECT id FROM tag WHERE name IN(?)
			) AS b ON a.tid = b.id GROUP BY a.gid HAVING COUNT(a.gid) = ? ORDER BY NULL
		) AS b ON a.gid = b.gid WHERE expunged = 0`,
		[tags, tags.length]
	))[0];

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

module.exports = tagList;