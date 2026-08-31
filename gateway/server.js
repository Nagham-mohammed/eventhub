const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use(cors());

const services = {
  auth: "http://auth-service:8082",
  catalog: "http://catalog-service:8081",
  booking: "http://booking-service:8083",
  ai: "http://ai-insight-service:8084",
  analytics: "http://analytics-service:8085",
};

app.use(
  "/api/auth",
  createProxyMiddleware({
    target: services.auth,
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/auth/",
    },
  })
);

app.use(
  "/api/catalog",
  createProxyMiddleware({
    target: services.catalog,
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/catalog/",
    },
  })
);

app.use(
  "/api/bookings",
  createProxyMiddleware({
    target: services.booking,
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/bookings",
    },
  })
);

app.use(
  "/api/reviews",
  createProxyMiddleware({
    target: services.booking,
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/reviews",
    },
  })
);

app.use(
  "/api/analyze",
  createProxyMiddleware({
    target: services.ai,
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/analyze/",
    },
  })
);

app.use(
  "/api/analytics",
  createProxyMiddleware({
    target: services.analytics,
    changeOrigin: true,
    pathRewrite: {
      "^/": "/api/analytics/",
    },
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(8080, () => {
  console.log("Gateway running on http://localhost:8080");
});
