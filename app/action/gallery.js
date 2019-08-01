const ConnectDB = require('../util/connectDB');
const getResponse = require('../util/getResponse');

const gallery = async (req, res) => {
	const { gid = '', token = '' } = Object.assign({}, req.params, req.query);
	if (!/^\d+$/.test(gid) || !/^[0-9a-f]{10}$/.test(token)) {
		return res.json(getResponse(null, 400, 'gid or token is invalid'));
	}

	const conn = await new ConnectDB().connect();

	const result = await conn.query('SELECT * FROM gallery WHERE gid = ? AND token = ?', [gid, token]);
	if (!result.length) {
		conn.destroy();
		return res.json(getResponse(null, 404, 'no gallery matches gid and token'));
	}

	const tags = await conn.query('SELECT name FROM tag WHERE id IN (SELECT tid FROM gid_tid WHERE gid = ?)', [gid]);

	conn.destroy();
	return res.json(getResponse(
		{ ...result[0], tags: tags.map(({ name }) => name) },
		200,
		'success'
	));
};

module.exports = gallery;