module.exports = [
  {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: [{ loader: 'ts-loader', options: { transpileOnly: true } }]
  },
  { test: /\.css$/, use: ['style-loader', 'css-loader'] },
  { test: /\.(woff2?|png|svg)$/, type: 'asset/resource' }
];
