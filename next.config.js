/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignore React Native and Node.js-specific modules in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "@react-native-async-storage/async-storage": false,
        "pino-pretty": false,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Ignore warnings for specific modules
    config.ignoreWarnings = [
      { module: /node_modules\/@metamask\/sdk/ },
      { module: /node_modules\/pino/ },
    ];

    return config;
  },
};

module.exports = nextConfig;
