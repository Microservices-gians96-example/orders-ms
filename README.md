# Orders Microservice
```	
docker-compose up -d
```
## Development pasos

1. Clonar el repositorio
2. Instalar dependencias
```	
npm install
```
3. Crear el archivo .env basado en el archivo .env.template
4. Levantar el servidor de Nats
```
docker run -d --name nats-main -p 4222:4222 -p 6222:6222 -p 8222:8222 nats
```
5. Iniciar el servidor de desarrollo
```
npm run start:dev
```
4. Iniciar el cliente

