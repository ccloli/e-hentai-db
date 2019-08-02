const serverError = require('../action/serverError');

const catchError = action => (...args) => {
	Promise.resolve(action(...args)).catch(err => {
		console.error(err.stack || err);
		serverError(...args);
	});
};

module.exports = catchError;