const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = ({ prod = false } = {}) => ({
	entry: [
		...(!prod ? [
			'webpack-dev-server/client?http://localhost:8080/',
			// 'webpack-hot-middleware/client',
			'react-hot-loader/patch',
			'webpack/hot/only-dev-server'
		] : []),
		'./src/index.js',
	],
	output: {
		filename: 'static/js/[name].js',
		publicPath: '/',
		path: path.resolve(__dirname, 'dist'),
	},
	resolve: {
		modules: [
			path.resolve('./'),
			path.resolve('./index.js'),
			path.resolve('./node_modules'),
		],
		extensions: ['.js', '.jsx', '.css'],
	},
	module: {
		rules: [
			{
				test: /\.jsx?$/,
				exclude: /node_modules/,
				loader: 'babel-loader',
			},
			{
				test: /\.css$/,
				loader: [
					{
						loader: MiniCssExtractPlugin.loader,
						options: {
							hmr: !prod,
						},
					},
					{
						loader: 'css-loader',
						options: {
							modules: true,
							importLoaders: 1
						}
					}
				]
			},
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			minify: {
				html5: true,
			},
			hash: 'true',
			title: 'E-Hentai DB',
			template: 'src/index.ejs',
		}),
		new MiniCssExtractPlugin({
			filename: 'static/css/[name].css',
		}),
		new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
		// new BundleAnalyzerPlugin()
	],
	...(prod ? {
		optimization: {
			splitChunks: {
				cacheGroups: {
					commons: {
						test: /[\\/]node_modules[\\/]/,
						name: 'vendors',
						chunks: 'all'
					}
				}
			}
		}
	} : {
		devServer: {
			hot: true,
			historyApiFallback: true,
			overlay: {
				warnings: true,
				errors: true,
			},
			proxy: {
				'/api': {
					target: `http://127.0.0.1:${require('./config').port}`,
					secure: false,
					changeOrigin: true
				}
			}
		}
	}),
});