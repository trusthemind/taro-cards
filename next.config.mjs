/** @type {import('next').NextConfig} */
const nextConfig = {
  // `ignoreBuildErrors` used to be on here, which meant a type error could ship
  // to production unnoticed. Type checking is the point of having TypeScript.
  images: {
    // Card art is local, pre-sized and already optimised, so Next's optimiser
    // would only add cost.
    unoptimized: true,
  },
}

export default nextConfig
