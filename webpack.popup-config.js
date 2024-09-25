const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");

module.exports = {
    node: {
        global: true
    },
    mode: "production",
    entry: "./src/extension/popup/popup.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "popup.js",
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "popup.css"
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.ProvidePlugin({
            process: "process/browser.js",
        })
    ], 
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: 'css-loader', options: { importLoaders: 1 } },
                    //{ loader: 'resolve-url-loader' },
                    { loader: 'postcss-loader', options: { sourceMap: true } },
                ],
            },
	    {
                test: /\.(png|svg|jpg|jpeg|gif|woff|woff2|eot|ttf|otf)$/i,
                type: "asset/resource",
            },
        ],
    },
    resolve: {
        fallback: {
            crypto: require.resolve("crypto-browserify"),
            stream: require.resolve("stream-browserify"),
            vm:     require.resolve("vm-browserify"),
            buffer: require.resolve("buffer/")
        }
    }
};
