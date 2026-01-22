# Brainstorm - Hacker Game

## Concepto General
- Simulador de hacker web con estilo visual moderno
- Mundo sandbox libre con eventos dinámicos
- Programación de scripts dentro del juego
- Sistema de upgrade de hardware

## Lenguaje de Scripting

### Características
- Sintaxis estilo C# (procedural, sin clases)
- Entry point: `Main()` obligatorio
- Funciones custom definibles
- Tipos básicos: `int`, `string`, `bool`, `float`
- Arrays: `string[]`, `int[]`, etc.

### Ejemplo de Script
```csharp
void Main() {
    string target = "192.168.1.100";
    if (ScanPorts(target)) {
        ExploitServer(target);
    }
}

bool ScanPorts(string ip) {
    Console.Log("Scanning " + ip + "...");
    int openPorts = Scan(ip);
    return openPorts > 0;
}

void ExploitServer(string ip) {
    Connect(ip, 22);
    Exploit("ssh_vuln");
    File.Download("/sensitive/data.db", "local/");
    File.Delete("/var/log/auth.log");
}
```

## Sistema de Hardware

### Componentes y Limitaciones
- **CPU**: Velocidad de ejecución de scripts
- **RAM**: Tamaño máximo de script + scripts en paralelo
- **Disco**: Almacenamiento de scripts y archivos robados
- **Conexión**: Ping/latencia para operaciones remotas
- **GPU**: Por definir (cracking, rendering, etc.)

### API basada en Dispositivos
```csharp
void Main() {
    string myPC = "00:1A:2B:3C:4D:5E";
    string myWiFi = "AA:BB:CC:DD:EE:FF";

    // Escanear red
    var scan = Device.Exec(myWiFi, "scan", new string[] {});

    // Conectar y explotar
    Device.Exec(myWiFi, "connect", new string[] { "192.168.1.100", "22" });
    Device.Exec(myPC, "exploit", new string[] { "ssh_vuln" });
}
```

- Device.Exec(macAddress, command, params) retorna diferentes tipos según dispositivo
- Cada dispositivo físico tiene capacidades específicas
- Los upgrades son tangibles (comprar nuevo WiFi adapter, GPU, etc.)

## Sistema de Archivos

### Operaciones con Files
- `File.Read(path)` - Lee contenido
- `File.Write(path, content)` - Escribe/modifica
- `File.Delete(path)` - Elimina archivo
- `File.Download(remotePath, localPath)` - Descarga a tu PC
- `File.Upload(localPath, remotePath)` - Sube desde tu PC
- `File.List(directory)` - Lista archivos
- `File.Exists(path)` - Verifica si existe
- `File.Move(from, to)` - Mueve/renombra

### Logs como Archivos Reales
- Los logs son archivos en el filesystem (ej: `/var/log/auth.log`)
- No hay función mágica para borrar logs
- Necesitás permisos (root/admin) para modificarlos
- Cada servidor/nodo tiene su propio sistema de logs

## Sistema de Rastreo y Consecuencias

### Logs Distribuidos
- Cada empresa/servidor tiene logs
- Cada nodo intermedio (proxies, routers, ISPs) también loguea
- Los logs persisten por X tiempo

### Rastreo Automático
- Bots recorren los logs periódicamente
- Si rastrean hasta vos → consecuencias

### Consecuencias Escalonadas
- **Intrusión leve**: Congelan cuenta bancaria
- **Intrusión grave**: Bloqueo de misiones/accesos
- **Múltiples detecciones**: Multas, pérdida de hardware, etc.

### Estrategias de Evasión
- Borrar logs manualmente (con permisos necesarios)
- Usar proxies/VPNs/botnets
- Planear rutas complejas
- Actuar antes que los bots procesen los logs

## Mundo Dinámico

### Eventos Emergentes
- Empresas NPC que viven su vida (abren, cierran, crecen)
- Eventos mundiales aleatorios:
  - Nuevas empresas con vulnerabilidades
  - Filtraciones de información
  - Startups de crypto
  - Investigaciones de seguridad

### Características
- Oportunidades temporales (ventanas para atacar)
- Consecuencias persistentes (empresas mejoran seguridad)
- Economía viva (empresas que crecen = más data valiosa)

## Mecánicas de Juego

### Modo Sandbox Libre
- No hay campaña lineal
- El jugador elige qué atacar
- Progresión emergente

### Objetivos
- Hackear diferentes tipos de sistemas
- Robar y vender datos
- Mejorar hardware
- Evitar ser rastreado
- Construir reputación en la comunidad hacker

## Estilo Visual
- Interfaz moderna (inspiración: proyecto dataoilmanager-front)
- NO terminal retro, interfaz gráfica contemporánea
- Posiblemente con elementos de UI tipo dashboard/panels

## Stack Tecnológico (Por Definir)
- Web-based game
- Opciones consideradas:
  - React + TypeScript + Vite + Tailwind (familiar)
  - Blazor (C# nativo en WASM)
  - Custom engine con intérprete propio
