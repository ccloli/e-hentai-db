import React from 'react';
import styles from './Rating.css';

const Star = ({ half = false, full = false }) => (
	<span className={`${styles.star} ${half ? styles.half : full ? styles.full : ''}`.trim()} />
);

export default Star;