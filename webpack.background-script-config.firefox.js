const path = require("path");
const webpack = require("webpack");

module.exports = {
    mode: "production",
    entry: "./build/extension/background-script.js",
    output: {
        path: path.resolve(__dirname, "./dist/"),
        filename: "./background-script.js",
        pathinfo: true,
        library: {
            type: "umd",
            name: "add",
        }
    },
    resolve: {
        alias: {
            "assert": false,
            "fs": false,
            "http": false,
            "os": false,
            "net": false,
            "tls": false,
            "https": false,
            "sqlite3": false,
            "postgresql-client": false
        },
        extensions: [".tsx", ".ts", ".js"],
        fallback: {
            crypto: require.resolve("crypto-browserify"),
            path:   require.resolve("path-browserify"),
            stream: require.resolve("stream-browserify"),
            vm:     require.resolve("vm-browserify"),
            util: require.resolve('util'),
            buffer: require.resolve("buffer/")
        }
    },
    module: {
        noParse: /\/node_modules\/process\//,
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: "process/browser.js",
        }),
        new webpack.DefinePlugin({
            process: {
                env: {
                    "process.env.NODE_ENV" : JSON.stringify("production")
                }
            }
        }),
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"],
        }),
    ]
};
