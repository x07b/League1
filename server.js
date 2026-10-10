const fs = require("fs");
const http = require("http");
const path = require("path");
const url = require("url");

const {
  BASE_DIR,
} = require("./config");

const {
  getStandings,
} = require("./scraper");

const {
  buildPayload,
} = require("./renderer");


const HOST =
  "127.0.0.1";

const DEFAULT_PORT =
  8000;


const MIME_TYPES = {

  ".html":
    "text/html; charset=utf-8",

  ".js":
    "application/javascript; charset=utf-8",

  ".css":
    "text/css; charset=utf-8",

  ".json":
    "application/json; charset=utf-8",

  ".png":
    "image/png",

  ".jpg":
    "image/jpeg",

  ".jpeg":
    "image/jpeg",

  ".webp":
    "image/webp",

  ".gif":
    "image/gif",

  ".svg":
    "image/svg+xml",

  ".ico":
    "image/x-icon",

  ".woff":
    "font/woff",

  ".woff2":
    "font/woff2",

  ".otf":
    "font/otf",

};


function sendJson(
  res,
  statusCode,
  data
) {

  const body =
    JSON.stringify(data);


  res.writeHead(
    statusCode,
    {

      "Access-Control-Allow-Origin":
        "*",

      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(body),

    }
  );


  res.end(body);

}


function safeFilePath(
  requestPath
) {

  const decoded =
    decodeURIComponent(
      requestPath
    );


  const cleanPath =
    decoded === "/"
      ? "/index.html"
      : decoded;


  const filePath =
    path.resolve(
      BASE_DIR,
      "." + cleanPath
    );


  const basePath =
    path.resolve(
      BASE_DIR
    );


  if (
    filePath !== basePath &&
    !filePath.startsWith(
      basePath + path.sep
    )
  ) {

    return null;

  }


  return filePath;

}


function serveStatic(
  req,
  res
) {

  const parsed =
    url.parse(req.url);


  const filePath =
    safeFilePath(
      parsed.pathname || "/"
    );


  if (!filePath) {

    res.writeHead(403);

    res.end("Forbidden");

    return;

  }


  fs.stat(
    filePath,
    (error, stats) => {

      if (
        error ||
        !stats.isFile()
      ) {

        res.writeHead(404);

        res.end("Not found");

        return;

      }


      const ext =
        path
          .extname(filePath)
          .toLowerCase();


      const contentType =
        MIME_TYPES[ext] ||
        "application/octet-stream";


      res.writeHead(
        200,
        {

          "Content-Type":
            contentType,

          "Cache-Control":
            "no-cache",

        }
      );


      fs.createReadStream(
        filePath
      ).pipe(res);

    }
  );

}


async function updateStandings() {

  console.log(
    "\n" +
    "=".repeat(60)
  );

  console.log(
    " LA ANT MATCH - Flashscore -> Node.js"
  );

  console.log(
    "=".repeat(60)
  );


  const standings =
    await getStandings();


  if (
    standings.length !== 16
  ) {

    throw new Error(
      `Expected 16 teams, but scraper returned ${standings.length}.`
    );

  }


  standings.sort(
    (a, b) =>
      Number(a.rank) -
      Number(b.rank)
  );


  console.log(
    "\nCLASSEMENT:"
  );


  for (
    const team
    of standings
  ) {

    const logo =
      team.logo ||
      team.logo_src
        ? "LOGO OK"
        : "NO LOGO";


    console.log(

      `${String(team.rank).padStart(2, " ")} | ` +

      `MJ=${team.played} | ` +

      `PTS=${team.points} | ` +

      `${logo}`

    );

  }


  console.log(
    "\nDONE."
  );


  return standings;

}


const server =
  http.createServer(
    async (req, res) => {

      const parsed =
        url.parse(req.url);


      /*
       * UPDATE API
       */

      if (
        req.method === "POST" &&
        parsed.pathname ===
          "/api/update"
      ) {

        try {

          const standings =
            await updateStandings();


          sendJson(
            res,
            200,
            buildPayload(
              standings
            )
          );


        } catch (error) {

          console.error(
            "UPDATE ERROR:",
            error
          );


          sendJson(
            res,
            500,
            {

              error:
                error.message ||
                "Update failed",

            }
          );

        }


        return;

      }


      /*
       * CORS PREFLIGHT
       */

      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(
          204,
          {

            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
              "Content-Type",

          }
        );


        res.end();

        return;

      }


      /*
       * STATIC FILES
       */

      if (
        req.method === "GET" ||
        req.method === "HEAD"
      ) {

        serveStatic(
          req,
          res
        );

        return;

      }


      res.writeHead(
        405
      );

      res.end(
        "Method not allowed"
      );

    }
  );


function parseArgs() {

  const args =
    process.argv.slice(2);


  let port =
    DEFAULT_PORT;

  let watch =
    false;

  let interval =
    300;


  for (
    let i = 0;
    i < args.length;
    i++
  ) {

    const arg =
      args[i];


    if (
      arg === "--port" &&
      args[i + 1]
    ) {

      port =
        Number(
          args[i + 1]
        );

      i++;

    }


    else if (
      arg === "--watch"
    ) {

      watch =
        true;

    }


    else if (
      arg === "--interval" &&
      args[i + 1]
    ) {

      interval =
        Math.max(
          10,
          Number(
            args[i + 1]
          )
        );

      i++;

    }

  }


  return {
    port,
    watch,
    interval,
  };

}


async function runOnce() {

  const standings =
    await updateStandings();


  return standings;

}


async function startWatch(
  interval
) {

  while (true) {

    try {

      await runOnce();

    } catch (error) {

      console.error(
        "ERROR:",
        error.message
      );

    }


    console.log(
      `\nNext update in ${interval}s...`
    );


    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          interval * 1000
        )
    );

  }

}


async function main() {

  const {
    port,
    watch,
    interval,
  } = parseArgs();


  /*
   * Automatic update mode
   */

  if (watch) {

    await startWatch(
      interval
    );

    return;

  }


  /*
   * Normal server mode
   */

  server.listen(
    port,
    HOST,
    () => {

      console.log(
        "LA ANT MATCH Node server running."
      );

      console.log(
        `Open http://${HOST}:${port}/index.html`
      );

      console.log(
        `API: POST http://${HOST}:${port}/api/update`
      );

    }
  );

}


main().catch(
  (error) => {

    console.error(
      error
    );

    process.exit(
      1
    );

  }
);