const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = [
  {
    mode: "development",
    entry: "./electron/main/index.js",
    target: "electron-main",
    output: {
      path: path.resolve(__dirname, "dist/electron"),
      filename: "main.bundle.js",
    },
  },
  {
    mode: "development",
    entry: "./electron/preload/index.js",
    target: "electron-preload",
    output: {
      path: path.resolve(__dirname, "dist/electron"),
      filename: "preload.bundle.js",
    },
  },
  {
    mode: "development",
    entry: "./electron/renderer/index.js",
    target: "electron-renderer",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.s?css$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                modules: {
                  auto: true,
                  localIdentName: "[local]-[hash:base64:5]",
                  namedExport: true,
                },
              },
            },
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: [
                    [
                      "postcss-preset-env",
                      {
                        browsers: "last 2 versions",
                      },
                    ],
                  ],
                },
              },
            },
            "sass-loader",
          ],
        },
      ],
    },
    output: {
      path: path.resolve(__dirname, "dist/electron"),
      filename: "renderer.bundle.js",
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./electron/renderer/index.html",
        filename: "index.html",
      }),
    ],
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
  },
];
