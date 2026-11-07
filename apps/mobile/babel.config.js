// NativeWind: className을 React Native 스타일로 바꿔 주는 설정이에요.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
