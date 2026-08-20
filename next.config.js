/** @type {import('next').NextConfig} */
const nextConfig={async rewrites(){return[{source:"/api/analyze",destination:"/api/analyze-v2"}]}};module.exports=nextConfig;
