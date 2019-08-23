import React from 'react';
import styles from './Modal.css';

const Modal = ({ visible, onClose, children }) => visible ? (
	<div className={styles.container}>
		<div className={styles.outer} onClick={onClose}></div>
		<div className={styles.content}>{children}</div>
	</div>
) : null;

export default Modal;