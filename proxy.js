const http = require("http"),
    httpProxy = require("http-proxy"),
    url = require('url'),
    crypto = require('crypto');

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

const urlsByReferer = {};
const urlsByCoookie = {};
const httpServer = http.createServer(function (req, res) {
    const queryObject = url.parse(req.url, true).query;

    const cookie = parseCookies(req)['foofurbot-proxy'];
    const referer = req.headers?.referer && (url.parse(req.headers?.referer)).path;

    const proxy = httpProxy.createProxyServer();

    // check for URL
    if (queryObject["foofurbot-proxy-url"]) {
        // reset cookie and referer
        delete urlsByCoookie[cookie];
        delete urlsByReferer[referer];

        // new referer
        urlsByReferer[req.url] = queryObject["foofurbot-proxy-url"];

        // new cookie
        proxy.on('proxyRes', function (proxyRes, req, res) {
            const seed = crypto.randomBytes(24).toString('hex');        
            proxyRes.headers["set-cookie"].push(`foofurbot-proxy=${seed}`);
            urlsByCoookie[seed] = queryObject["foofurbot-proxy-url"];
        });

        // proxy
        proxy.web(req, res, {
            target: queryObject["foofurbot-proxy-url"],
            changeOrigin: true,
            xfwd: true,
        }, (e) => {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.write(`El servicio que buscas no está disponible (${e.message})`);
            res.end();
        });
    } else {
        // check if referer or cookie
        const existsUrl = urlsByReferer[referer] || urlsByCoookie[cookie];
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
            res.write(`No hay nada de lo que hacer proxy. Añáde un campo url a tu query`);
            res.end();
        }
    }

    proxy.close();
});

httpServer.on('upgrade', function (req, socket, head) {
    const queryObject = url.parse(req.url, true).query;
    const proxy = httpProxy.createProxyServer();

    // check for URL
    if (queryObject["foofurbot-proxy-url"]) {
        // proxy
        req.url = '';
        proxy.ws(req, socket, head, {
            target: queryObject["foofurbot-proxy-url"],
            changeOrigin: true,
        }, (e) => {
            socket.destroy();
        });
    }

    proxy.close();
});

httpServer.listen(2000);

console.log("Escuchando!");
