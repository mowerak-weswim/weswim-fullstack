/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/community",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
