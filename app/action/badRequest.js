const getResponse = require('../util/getResponse');

const badRequest = (req, res) => {
	return res.json(getResponse(null, 400, 'bad request'));
};

module.exports = badRequest;