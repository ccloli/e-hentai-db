const matchExec = (input, regex) => {
	let exec;
	const matches = [];
	// eslint-disable-next-line no-cond-assign
	while (exec = regex.exec(input)) {
		matches.push(exec);
	}
	return matches;
};

module.exports = matchExec;