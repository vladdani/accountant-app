/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add serverActions configuration
  serverActions: {
    bodySizeLimit: '10mb', // Increase limit to 10MB
  },
  // ... your existing config ...
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /node_modules\/punycode/ }
    ];
    return config;
  },
}

module.exports = nextConfig 