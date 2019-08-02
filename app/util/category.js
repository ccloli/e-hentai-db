const categoryList = ['Misc', 'Doujinshi', 'Manga', 'Artist CG', 'Game CG', 'Image Set', 'Cosplay', 'Asian Porn', 'Non-H', 'Western'];

const categoryMap = {};
categoryList.forEach((item, index) => {
	categoryMap[1 << index] = item;
});

module.exports = {
	categoryMap,
	categoryList
};