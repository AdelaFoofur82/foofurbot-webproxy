const http = require("http"),
    httpProxy = require("http-proxy"),
    url = require('url'),
    crypto = require('crypto');

const config = require('./config');

function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers?.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(function (cookie) {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
}

const urlsByCoookie = {};
const httpServer = http.createServer(function (req, res) {
    const queryObject = url.parse(req.url, true).query;

    const cookie = parseCookies(req)[config["cookie-name"]];

    const proxy = httpProxy.createProxyServer();

    // check for URL
    if (queryObject[config["query-parameter"]]) {
        // reset cookie
        delete urlsByCoookie[cookie];

        // new cookie
        proxy.on('proxyRes', function (proxyRes, req, res) {
            const seed = crypto.randomBytes(24).toString('hex');
            proxyRes.headers["set-cookie"].push(`${config["cookie-name"]}=${seed}`);
            urlsByCoookie[seed] = queryObject[config["query-parameter"]];
        });

        // proxy
        proxy.web(req, res, {
            target: queryObject[config["query-parameter"]],
            changeOrigin: true,
            xfwd: true,
        }, (e) => {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.write(`El servicio que buscas no está disponible (${e.message})`);
            res.end();
        });
    } else {
        // check if cookie
        const existsUrl = urlsByCoookie[cookie];
        if (existsUrl) {
            proxy.web(req, res, {
                target: existsUrl,
                changeOrigin: true,
                xfwd: true,
            }, (e) => {
                res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
                res.write(`El servicio que buscas no está disponible (${e.message})`);
                res.end();
            });
            return;
        } else {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.write(`No hay nada de lo que hacer proxy. Añade un campo "${config["query-parameter"]}" a tu query`);
            res.end();
        }
    }

    proxy.close();
});

httpServer.on('upgrade', function (req, socket, head) {
    const queryObject = url.parse(req.url, true).query;
    const proxy = httpProxy.createProxyServer();

    // check for URL
    if (queryObject[config["query-parameter"]]) {
        // proxy
        req.url = '';
        proxy.ws(req, socket, head, {
            target: queryObject[config["query-parameter"]],
            changeOrigin: true,
        }, (e) => {
            socket.destroy();
        });
    }

    proxy.close();
});

httpServer.listen(config.port);

console.log("Escuchando!");
