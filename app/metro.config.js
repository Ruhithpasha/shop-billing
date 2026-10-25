// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The on-device image-embedding model (react-native-fast-tflite).
config.resolver.assetExts.push("tflite");

module.exports = config;
