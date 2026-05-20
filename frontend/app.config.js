// 扩展 app.json，不修改原有文件，仅新增 EAS Build 所需配置
// 当 app.config.js 存在时 Expo 自动使用此文件，忽略 app.json
const appJson = require('./app.json');

module.exports = {
  expo: {
    ...appJson.expo,
    newArchEnabled: true,
    ios: {
      ...appJson.expo.ios,
      bundleIdentifier: 'com.yamzooooo.foodcalorie',
    },
    android: {
      ...appJson.expo.android,
      edgeToEdgeEnabled: true,
      usesCleartextTraffic: true,
      package: 'com.yamzooooo.foodcalorie',
    },
    extra: {
      ...(appJson.expo.extra || {}),
      eas: {
        projectId: 'd55d42f1-7c02-48d9-a049-d171ffaadec5',
      },
    },
  },
};
