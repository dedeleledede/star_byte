# Self-Hosting Guide (`star_byte`)

Guia para hospedar uma instância própria do **star_byte** em produção.

## 1. Requisitos e Domínios
- Um servidor Linux com acesso à internet e IP público/estático.
- Domínios apontados para o IP do servidor via registros DNS `A` (e `AAAA`, se usar IPv6):
  - Aplicação web: `chat.seu-dominio.com`
  - API / WebSocket (se em subdomínio separado): `api.seu-dominio.com`

## 2. HTTPS e Roteamento de WebSocket (Reverse Proxy)
Use um reverse proxy (como Nginx ou Caddy) na frente da aplicação para encerrar TLS/HTTPS e encaminhar tráfego HTTP e WebSocket.

Exemplo de configuração com **Nginx**:

```nginx
server {
    listen 80;
    server_name chat.seu-dominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chat.seu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/[chat.seu-dominio.com/fullchain.pem](https://chat.seu-dominio.com/fullchain.pem);
    ssl_certificate_key /etc/letsencrypt/live/[chat.seu-dominio.com/privkey.pem](https://chat.seu-dominio.com/privkey.pem);

    # Frontend / Web App
    location / {
        proxy_pass [http://127.0.0.1:5173](http://127.0.0.1:5173);
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket / API
    location /ws {
        proxy_pass [http://127.0.0.1:3000](http://127.0.0.1:3000);
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

