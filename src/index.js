import 'core-js/stable';
import 'abortcontroller-polyfill/dist/polyfill-patch-fetch';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

const render = () => {
	ReactDOM.render(
		<App />, document.getElementById('root')
	);
};

render();

if (module.hot) {
	module.hot.accept('./App', render);
}