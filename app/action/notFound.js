const getResponse = require('../util/getResponse');

const notFound = (req, res) => {
	return res.status(404).json(getResponse(null, 404, 'not found'));
};

module.exports = notFound;