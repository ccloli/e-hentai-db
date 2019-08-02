const getResponse = require('../util/getResponse');

const notFound = (req, res) => {
	return res.status(500).json(getResponse(null, 500, 'internal server error'));
};

module.exports = notFound;