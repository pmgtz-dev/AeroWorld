/** @type {import('next').NextConfig} */
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../", process.env.DOCKER_ENV === "yes" ? ".env" : ".env.local"),
  override: true,
});

module.exports = {
  reactStrictMode: true,
  devIndicators: {
    position: "bottom-left", 
  },
};

