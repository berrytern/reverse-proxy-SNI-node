# HTTPS Reverse Proxy with SNI Support

## Overview
This project, **reverse-proxy-SNI**, is an HTTPS reverse proxy designed to handle multiple domains using the same IP and port. It uses Server Name Indication (SNI) to dynamically load SSL certificates and routes requests based on the `Host` header. Incoming requests are forwarded to target services defined in a `config.json` file.

## Features
- **SNI Support**: Dynamically loads SSL certificates for different domains.
- **Dynamic Routing**: Routes requests based on the `Host` header to the appropriate target service.
- **Custom Configuration**: Uses a `config.json` file to define SSL credentials and target services.
- **Error Handling**: Provides structured JSON responses for errors.
- **Security Enhancements**: Includes features like `cors` and `helmet` for enhanced security.
- **Logging**: Provides detailed logs with `morgan`.
- **Environment Variable Support**: Allows dynamic configurations using environment variables.

## Requirements
- Node.js (v14 or higher)
- A valid SSL certificate for each domain
- `config.json` file or environment variables to define domain configurations

## Installation
1. Install Node.js by following the instructions at [nodejs.org](https://nodejs.org/).
2. Clone this repository:
   ```bash
   git clone git@github.com:berrytern/reverse-proxy-SNI.git
   cd reverse-proxy-SNI
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Usage
1. Create a `config.json` file in the root directory with your domain configurations based on the provided schema.
    ```bash
    cp config.json.example config.json
    ```
2. Alternatively, set environment variables for domain configurations (see **Environment Variables** section).
3. Start the application:
   ```bash
   npm start
   ```
4. The proxy will listen on `0.0.0.0` on the default port 443 and handle incoming HTTPS requests.

## Configuration
### Using `config.json`
The `config.json` file must define the domain configurations as follows:
```json
{
    "example.com": {
        "target": "https://localhost:3000",
        "ssl": {
            "key_path": "/path/to/privkey.pem",
            "cert_path": "/path/to/fullchain.pem",
            "ca_path": "/path/to/chain.pem"
        }
    }
}
```
- `target`: The target service URL to which requests will be forwarded.
- `ssl`: SSL configuration for the domain, including paths to the key, certificate, and CA bundle.


## Key Functionality
### Dynamic SSL Configuration
SSL certificates are loaded dynamically based on the domain using the SNI callback. Ensure the certificates and private keys are correctly specified in `config.json` or environment variables.

### Forwarding Requests
Incoming requests are forwarded to the target service defined in `config.json` or environment variables. The proxy:
- Preserves the HTTP method, headers, and body.
- Adds an `X-Forwarded-For` header with the client IP.
- Supports query parameters and redirects.

### Error Responses
Errors are returned as JSON objects with the following structure:
```json
{
    "error": "Description of the error",
    "details": "Optional details",
    "code": "Optional error code"
}
```

## Security
- **CORS**: Cross-origin resource sharing is enabled with default settings.
- **Helmet**: Adds security-related HTTP headers.
- **TLS Validation**: Ensures secure connections to target services.

## Logging
The application uses `morgan` for logging requests. Logs are displayed in the following format:
```bash
[date] method url status response-time ms
```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any bugs or feature requests.

## License
This project is licensed under the MIT License. See the `LICENSE` file for more details.
