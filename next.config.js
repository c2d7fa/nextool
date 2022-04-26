module.exports = {
  reactStrictMode: true,

  async redirects() {
    return [
      {source: "/download", destination: "https://github.com/c2d7fa/nextool/releases/latest", permanent: false},
    ];
  }
};
