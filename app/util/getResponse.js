const getResponse = (data, code = 200, message = '') => ({
	code, data, message
});

module.exports = getResponse;