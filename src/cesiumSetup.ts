(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = new URL(
  "cesium/",
  document.baseURI,
).href;

export {};
