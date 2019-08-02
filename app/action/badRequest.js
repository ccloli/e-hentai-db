const getResponse = require('../util/getResponse');

const badRequest = (req, res) => {
	return res.code(400).json(getResponse(null, 400, 'bad request'));
};

module.exports = badRequest;