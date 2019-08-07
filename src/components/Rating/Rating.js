import React from 'react';
import Star from './Star';

const Rating = ({ value = 0 }) => {
	let rating = +value + 1;
	const starConfig = new Array(5).fill('').map(() => {
		rating -= 1;
		if (rating < 0.25) {
			return {};
		}
		if (rating < 0.75) {
			return { half: true };
		}
		return { full: true };
	});

	return starConfig.map((e, i) => (
		<Star key={i} {...e} />
	));
};

export default Rating;