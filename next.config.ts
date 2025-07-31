import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // This is to fix a bug in genkit that causes a build error in Vercel
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // This is to fix a bug in genkit that causes a build error in Vercel
    config.module.rules.push({
      test: /node_modules\/@genkit-ai\/core\/lib\/tracing\.js$/,
      loader: 'string-replace-loader',
      options: {
        search: `require(plugin.requirePath(name))`,
        replace: `{}`,
      },
    });

    return config;
  }
};

export default nextConfig;