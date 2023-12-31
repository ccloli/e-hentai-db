const shortMap = {
	a: 'artist',
	c: 'character',
	char: 'character',
	cos: 'cosplayer',
	f: 'female',
	g: 'group',
	circle: 'group',
	l: 'language',
	lang: 'language',
	m: 'male',
	x: 'mixed',
	o: 'other',
	p: 'parody',
	series: 'parody',
	r: 'reclass',
};

const normalizedTag = (tag) => {
	if (!tag.includes(':')) {
		// TODO: normalize misc & other
		return tag;
	}
	const [namespace, pattern] = tag.split(':');
	if (shortMap[namespace]) {
		return `${shortMap[namespace]}:${pattern}`;
	}
	return tag;
};

module.exports = normalizedTag;