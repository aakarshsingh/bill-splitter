import { defineRailway, github, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const region = "asia-southeast1-eqsg3a";

  // Only the people list is persisted; it lives at DATA_DIR (/app/data).
  const data = volume("bill-splitter-data", { region });

  const billSplitter = service("bill-splitter", {
    source: github("aakarshsingh/bill-splitter", { checkSuites: true }),
    healthcheck: "/api/health",
    replicas: { [region]: 1 },
    volumeMounts: { "/app/data": data },
    env: {
      ANTHROPIC_API_KEY: preserve(),
      APP_PASSWORD: preserve(),
      DATA_DIR: preserve(),
      NODE_ENV: preserve(),
      PORT: preserve(),
    },
  });

  return project("as-bill-splitter", {
    resources: [billSplitter, data],
  });
});
