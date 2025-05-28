#!/bin/bash

# Script de despliegue para el servidor MQTT
# Este script despliega la aplicación en el servidor MQTT

# Colores para salida en terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando despliegue del servidor MQTT para máquina expendedora...${NC}"

# Verificar si el directorio existe, si no, clonar el repositorio
if [ ! -d "vending-machine-mqtt-server" ]; then
  echo -e "${YELLOW}Clonando repositorio...${NC}"
  git clone https://github.com/tu-usuario/vending-machine-mqtt-server.git
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error al clonar el repositorio${NC}"
    exit 1
  fi
  cd vending-machine-mqtt-server
else
  echo -e "${YELLOW}Actualizando repositorio...${NC}"
  cd vending-machine-mqtt-server
  git pull
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error al actualizar el repositorio${NC}"
    exit 1
  fi
fi

# Instalar dependencias
echo -e "${YELLOW}Instalando dependencias...${NC}"
npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Error al instalar dependencias${NC}"
  exit 1
fi

# Crear archivo .env si no existe
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}Creando archivo .env...${NC}"
  cat > .env << EOL
# Configuración de la base de datos
DB_HOST=tu-ip-privada-sql
DB_PORT=5432
DB_NAME=iotdb
DB_USER=iotuser
DB_PASSWORD=tu_password_segura

# Configuración del broker MQTT
MQTT_BROKER_URL=mqtt://localhost
MQTT_BROKER_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Configuración general
NODE_ENV=production
PORT=3000
INIT_DATA=true
EOL
  echo -e "${GREEN}Archivo .env creado. Por favor, edita las credenciales antes de continuar.${NC}"
  echo -e "${YELLOW}Presiona cualquier tecla para continuar...${NC}"
  read -n 1 -s
fi

# Inicializar la base de datos
echo -e "${YELLOW}Inicializando la base de datos...${NC}"
npm run setup-db
if [ $? -ne 0 ]; then
  echo -e "${RED}Error al inicializar la base de datos${NC}"
  exit 1
fi

# Crear archivo de servicio systemd para mantener la aplicación en ejecución
echo -e "${YELLOW}Configurando servicio systemd...${NC}"
sudo tee /etc/systemd/system/vending-mqtt.service > /dev/null << EOL
[Unit]
Description=Vending Machine MQTT Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=$(which npm) start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Recargar systemd y habilitar el servicio
sudo systemctl daemon-reload
sudo systemctl enable vending-mqtt.service

# Iniciar el servicio
echo -e "${YELLOW}Iniciando el servicio...${NC}"
sudo systemctl start vending-mqtt.service

# Verificar estado del servicio
sudo systemctl status vending-mqtt.service

echo -e "${GREEN}Despliegue completado correctamente${NC}"
echo -e "${YELLOW}El servidor MQTT está corriendo como un servicio systemd${NC}"
echo -e "${YELLOW}Puedes verificar los logs con: sudo journalctl -u vending-mqtt.service -f${NC}"