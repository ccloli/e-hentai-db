const category = [
	{
		name: 'Doujinshi',
		value: 1 << 1,
		color: '#9e2720',
	}, {
		name: 'Manga',
		value: 1 << 2,
		color: '#db6c24',
	}, {
		name: 'Artist CG',
		value: 1 << 3,
		color: '#d38f1d',
	}, {
		name: 'Game CG',
		value: 1 << 4,
		color: '#617c63',
	}, {
		name: 'Western',
		value: 1 << 9,
		color: '#ab9f60',
	}, {
		name: 'Non-H',
		value: 1 << 8,
		color: '#5fa9cf',
	}, {
		name: 'Image Set',
		value: 1 << 5,
		color: '#325ca2',
	}, {
		name: 'Cosplay',
		value: 1 << 6,
		color: '#6a32a2',
	}, {
		name: 'Asian Porn',
		value: 1 << 7,
		color: '#a23282',
	}, {
		name: 'Misc',
		value: 1 << 0,
		color: '#777777',
	}
];

const categoryNameMap = category.reduce((pre, cur) => {
	pre[cur.name] = cur;
	return pre;
}, {});

export {
	categoryNameMap
};

export default category;