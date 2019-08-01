const getResponse = require('../util/getResponse');

const notFound = (req, res) => {
	return res.json(getResponse(null, 404, 'not found'));
};

module.exports = notFound;