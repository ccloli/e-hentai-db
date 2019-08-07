import React from 'react';
import { hot } from 'react-hot-loader/root';
import { BrowserRouter, Route } from 'react-router-dom';
import Home from './components/Home';

const App = () => (
	<BrowserRouter>
		<Route location="/" component={Home} />
	</BrowserRouter>
);

export default hot(App);