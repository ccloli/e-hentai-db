const ConnectDB = require('../util/connectDB');
const getResponse = require('../util/getResponse');

const gallery = async (req, res) => {
	const { gid = '', token = '' } = Object.assign({}, req.params, req.query);
	if (!/^\d+$/.test(gid) || !/^[0-9a-f]{10}$/.test(token)) {
		return res.json(getResponse(null, 400, 'gid or token is invalid'));
	}

	const conn = await new ConnectDB().connect();

	const result = (await conn.query('SELECT * FROM gallery WHERE gid = ? AND token = ?', [gid, token]))[0];
	if (!result) {
		conn.destroy();
		return res.json(getResponse(null, 404, 'no gallery matches gid and token'));
	}

	const { root_gid } = result;
	const tags = (await queryTags(conn, [gid]))[gid] || [];
	let torrents = [];
	if (result.root_gid) {
		const torrents = (await queryTorrents(conn, [root_gid]))[root_gid] || [];
	}

	conn.destroy();
	return res.json(getResponse(
		{ ...result, tags, torrents },
		200,
		'success'
	));
};

module.exports = gallery;