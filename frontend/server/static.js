const fs = require("fs");
const path = require("path");

function createStaticHelpers(config) {
  function setCorsHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-API-Key");
    res.setHeader("Access-Control-Max-Age", "600");
    res.setHeader("Vary", "Origin");
  }

  function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(body);
  }

  function serveStaticFile(reqPath, res, req = null) {
    const webRoot = path.resolve(config.resolveStaticRoot());
    const cleanPath = reqPath === "/" ? "/index.html" : reqPath;
    const relativePath = cleanPath.replace(/^\/+/, "");
    const absolutePath = path.resolve(webRoot, relativePath);
    const rootRelativePath = path.relative(webRoot, absolutePath);

    if (rootRelativePath.startsWith("..") || path.isAbsolute(rootRelativePath)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    fs.stat(absolutePath, (statErr, stats) => {
      if (statErr || !stats.isFile()) {
        if (statErr?.code === "ENOENT") {
          sendJson(res, 404, { error: "Not found" });
          return;
        }

        sendJson(res, 500, { error: "Failed to read static file" });
        return;
      }

      fs.readFile(absolutePath, (err, data) => {
        if (err) {
          sendJson(res, 500, { error: "Failed to read static file" });
          return;
        }

        const ext = path.extname(absolutePath).toLowerCase();
        const contentType = config.mimeTypes[ext] || "application/octet-stream";
        const etag = `W/"${stats.size}-${Number(stats.mtimeMs)}"`;
        const lastModified = stats.mtime.toUTCString();
        const isHtml = ext === ".html";
        const cacheControl = isHtml ? "no-store" : "public, max-age=604800, immutable";
        const ifNoneMatch = req?.headers?.["if-none-match"];
        const ifModifiedSince = req?.headers?.["if-modified-since"];

        if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince).getTime() >= stats.mtime.getTime())) {
          res.writeHead(304, {
            ETag: etag,
            "Last-Modified": lastModified,
            "Cache-Control": cacheControl,
          });
          res.end();
          return;
        }

        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": cacheControl,
          ETag: etag,
          "Last-Modified": lastModified,
        });
        res.end(data);
      });
    });
  }

  return {
    sendJson,
    serveStaticFile,
    setCorsHeaders,
  };
}

module.exports = {
  createStaticHelpers,
};
