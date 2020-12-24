const queryTorrents = async (conn, gids) => {
	const gidTorrents = {};
	if (!gids || !gids.length) {
		return gidTorrents;
	}
	const torrentResult = await conn.query(
		'SELECT * FROM torrent WHERE gid IN (?)', [gids]
	);
	torrentResult.forEach(({ gid, ...rest }) => {
		if (!gidTorrents[gid]) {
			gidTorrents[gid] = [];
		}
		gidTorrents[gid].push(rest);
	});
	return gidTorrents;
};

module.exports = queryTorrents;