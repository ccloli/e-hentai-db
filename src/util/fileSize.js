const fileSize = (size) => {
	const type = ['B', 'KB', 'MB', 'GB', 'TB'];
	let finalSize = size;
	while (finalSize >= 1024) {
		finalSize = finalSize / 1024;
		type.shift();
	}
	return `${finalSize.toFixed(2)} ${type[0]}`;
};

export default fileSize;