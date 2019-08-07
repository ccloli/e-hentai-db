const node = document.createElement('textarea');

const parseEntity = (val) => {
	node.innerHTML = val;
	return node.value;
};

export default parseEntity;