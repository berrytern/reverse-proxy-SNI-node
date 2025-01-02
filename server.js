const express = require('express');
const https = require('https');
const fs = require('fs');
const Ajv = require("ajv")
const axios = require('axios');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors')
const helmet = require('helmet')

const tls = require('tls');

const ajv = new Ajv({allErrors: true})

const app = express();
app.disable('x-powered-by');

app.use(cors())
app.use(helmet())

const schema = {
    type: "object",
    patternProperties: {
        '^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\\\\.[a-zA-Z]{2,})+$': {
            type: "object",
            properties:{
                target: {type: "string"},
                ssl: {
                    type:"object",
                    properties:{
                        key_path:{type:"string"},
                        cert_path:{type:"string"},
                        ca_path:{type:"string"}
                    },
                    required: ['key_path','cert_path','ca_path']
                }
            },
            required: ['target','ssl']
        }
    }
}
            

// Domain configurations
let domainRoutes = fs.readFileSync('./config.json')
domainRoutes = JSON.parse(domainRoutes)
if (ajv.validate(schema, domainRoutes)) {
    for (const key of Object.keys(domainRoutes)) {
        domainRoutes[key].ssl = {
            key: fs.readFileSync(domainRoutes[key].ssl.key_path),
            cert: fs.readFileSync(domainRoutes[key].ssl.cert_path),
            ca: fs.readFileSync(domainRoutes[key].ssl.ca_path)
        }
    }
} else {
    console.log(ajv.errors)
    process.exit(1)
}

// SSL configuration
const sslOptions = {
    key: fs.readFileSync('/etc/ssl/api1.nutespb.com.br/privkey.pem'),
    cert: fs.readFileSync('/etc/ssl/api1.nutespb.com.br/fullchain.pem'),
    ca: fs.readFileSync('/etc/ssl/api1.nutespb.com.br/chain.pem')
    // If you have intermediate certificates:
    // ca: fs.readFileSync('/path/to/your/ca-chain.crt')
};

// Middleware setup
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('[:date[clf]] :method :url :status :response-time ms'));


const sslApple = {
    key: fs.readFileSync('/etc/ssl/api1.nutespb.com.br/privkey.pem'),
    cert: fs.readFileSync('/etc/ssl/api1.nutespb.com.br/fullchain.pem'),
    ca: fs.readFileSync('/etc/ssl/api1.nutespb.com.br/chain.pem')
}


// Function to get SSL config based on hostname
function getSSLConfig(hostname) {
    const config = domainRoutes[hostname];
    if (config && config.ssl) {
        return config.ssl;
    }
    return sslOptions; // fallback to default SSL
}
async function forwardRequest(req, targetUrl) {
    const fullUrl = new URL(req.url, targetUrl).toString();

    const headers = { ...req.headers };
    headers['x-forwarded-for'] = req.ip
    console.log('headers', headers)
    delete headers['host'];
    delete headers['connection'];
    delete headers['content-length'];

    try {
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
            servername: new URL(targetUrl).hostname
        });

        const response = await axios({
            method: req.method,
            url: fullUrl,
            data: req.body,
            headers: headers,
            params: req.query,
            validateStatus: false,
            maxRedirects: 5,
            timeout: 30000,
            responseType: 'arraybuffer',
            httpsAgent: httpsAgent
        });

        return {
            status: response.status,
            headers: response.headers,
            data: response.data
        };
    } catch (error) {
        console.error('Forward request error:', {
            message: error.message,
            code: error.code,
            target: fullUrl
        });
        throw error;
    }
}

// Main request handler
app.use(async (req, res) => {
    const domain = req.hostname;
    const config = domainRoutes[domain];

    if (!config) {
        return res.status(404).json({ error: 'Domain not configured' });
    }

    try {
        console.log(`Forwarding ${req.method} ${req.url} to ${config.target}`);
        
        const response = await forwardRequest(req, config.target);

        // Copy response headers
        Object.entries(response.headers).forEach(([key, value]) => {
            if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        // Send response
        res.status(response.status);

        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
            try {
                const jsonData = JSON.parse(response.data.toString());
                res.json(jsonData);
            } catch (e) {
                res.send(response.data);
            }
        } else {
            res.send(response.data);
        }

    } catch (error) {
        console.error('Proxy error:', error.message);
        
        if (error.response) {
            res.status(error.response.status).send(error.response.data);
        } else if (error.code === 'ECONNREFUSED') {
            res.status(503).json({
                error: 'Target server unavailable',
                details: error.message
            });
        } else if (error.code === 'EPROTO' || error.code === 'ERR_SSL_PROTOCOL_ERROR') {
            res.status(502).json({
                error: 'SSL Protocol Error',
                details: error.message
            });
        } else {
            res.status(500).json({
                error: 'Proxy Internal Error',
                details: error.message,
                code: error.code
            });
        }
    }
});

const options = {
    // Função SNI que será chamada para cada conexão para determinar qual certificado usar
    SNICallback: (servername, cb) => {
        console.log(`SNI callback called for server: ${servername}`);
        
        // Procura a configuração SSL do domínio
        const config = domainRoutes[servername];
        if (config && config.ssl) {
            try {
                const ctx = tls.createSecureContext({
                    key: config.ssl.key,
                    cert: config.ssl.cert,
                    ca: config.ssl.ca
                });
                
                if (cb) {
                    cb(null, ctx);
                } else {
                    return ctx;
                }
            } catch (err) {
                console.error(`Error creating secure context for ${servername}:`, err);
                if (cb) cb(err);
                else throw err;
            }
        } else {
            console.warn(`No SSL config found for ${servername}, using default certificate`);
            // Fallback para o certificado padrão
            const ctx = tls.createSecureContext(sslOptions);
            if (cb) {
                cb(null, ctx);
            } else {
                return ctx;
            }
        }
    },
    // Incluir as configurações padrão para garantir compatibilidade
    ...sslOptions
};

// Criar servidor HTTPS com suporte a SNI
const httpsServer = https.createServer(options, app);

const PORT = process.env.PORT || 443;
httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTPS Reverse Proxy running on port ${PORT}`);
    console.log('Configured routes:');
    Object.entries(domainRoutes).forEach(([domain, config]) => {
        console.log(`${domain} -> ${config.target} (${config.name})`);
    });
});

