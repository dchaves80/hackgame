# 🎮 HACKGAME - Memoria del Proyecto

## 📋 Descripción General

Juego de simulación de hacking con un sistema operativo completo (estilo Uplink/Hacknet). El jugador tiene su propia PC con sistema de archivos, aplicaciones GUI, terminal, y debe hackear otros sistemas para ganar dinero.

---

## 🏗️ Arquitectura del Proyecto

```
hackgame/
├── backend-auth/          # Backend Node.js + Express
│   ├── src/
│   │   ├── controllers/   # Lógica de negocio
│   │   ├── models/        # Modelos de MongoDB (Mongoose)
│   │   ├── routes/        # Rutas de la API
│   │   ├── middleware/    # Auth middleware
│   │   ├── config/        # Configuración DB
│   │   ├── services/      # Socket.io service
│   │   └── syscript/      # VM, Compiler, Worker Pool
│   └── package.json
│
├── frontend-game/         # Frontend React + TypeScript + Vite
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── pages/         # Páginas principales
│   │   ├── contexts/      # Context API (Auth)
│   │   └── services/      # Servicios (eventos, API, socket)
│   └── package.json
│
├── docs/                  # Documentación técnica
│   └── SYSCRIPT.md        # Documentación del lenguaje
│
└── planning/              # Planning y diseño
```

---

## 🗄️ Stack Tecnológico

### Backend
- **Node.js** + **Express.js** - API REST
- **MongoDB** (Mongoose) - Filesystem, Computers, NPCs, Processes
- **SQL Server** (mssql) - Users, Sessions
- **Worker Threads** - Ejecución paralela de VM
- **Socket.io** - WebSocket para streaming en tiempo real
- **bcryptjs** - Hash de passwords
- **jsonwebtoken** - Autenticación JWT
- **Puerto**: 3000

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Estilos (tema cyber personalizado)
- **Axios** - Cliente HTTP
- **Socket.io-client** - WebSocket client
- **React Router** - Navegación
- **Puerto**: 5173

---

## 💻 Syscript VM - Sistema de Ejecución

### Arquitectura Worker Threads
```
┌─────────────────────────────────────────────────────────────────────┐
│                         MAIN THREAD                                 │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │ Express API │───►│ Terminal    │───►│ WorkerPoolManager       │ │
│  │             │    │ Controller  │    │ ├─ getWorker()          │ │
│  └─────────────┘    └─────────────┘    │ ├─ execute()            │ │
│                                         │ ├─ killCommand()        │ │
│                                         │ └─ releaseWorker()      │ │
│                                         └───────────┬─────────────┘ │
│                                                     │               │
│  ┌─────────────┐    ┌─────────────┐                │               │
│  │ Socket.io   │◄───│ IPC Handler │◄───────────────┘               │
│  │ Service     │    │             │                                 │
│  └─────────────┘    └─────────────┘                                 │
│         ▲                  ▲                                        │
│         │                  │ (messages)                             │
└─────────┼──────────────────┼────────────────────────────────────────┘
          │                  │
          │    ┌─────────────┴─────────────┐
          │    │      WORKER POOL (4)      │
          │    │                           │
          │    │  ┌─────────┐ ┌─────────┐  │
          │    │  │Worker 1 │ │Worker 2 │  │
          │    │  │┌───────┐│ │┌───────┐│  │
          │    │  ││  VM   ││ ││  VM   ││  │
          │    │  │└───────┘│ │└───────┘│  │
          │    │  └────┬────┘ └────┬────┘  │
          │    │       │           │       │
          │    └───────┼───────────┼───────┘
          │            │           │
          └────────────┴───────────┘
                   (output streaming)
```

### Archivos del Sistema VM
```
backend-auth/src/syscript/
├── compiler.js          # Compilador Syscript → Bytecode
├── bytecode-format.js   # Opcodes y Native APIs
├── vm-worker.js         # VM ejecutándose en Worker Thread
├── worker-pool.js       # Pool de 4 workers reutilizables
├── io-handler.js        # Operaciones I/O (MongoDB)
├── sources/             # Código fuente (.syscript)
└── binaries/            # Bytecode compilado (.json)
```

---

## ⚡ Sistema de CPU Speed

### Tiers de Procesadores (Hz = Instrucciones Por Segundo)
```
══════════════════════════════════════════════════════════════
Tier | Name             | Frequency  | IPS       | 1000 instr.
──────────────────────────────────────────────────────────────
 0   | SpudCore 2500    | 2.5 KHz    | 2,500     | 400ms     ★ STARTER
 1   | QuantumX         | 5 KHz      | 5,000     | 200ms
 2   | NeuralNet 9000   | 7.5 KHz    | 7,500     | 133ms
 3   | SkyNet Alpha     | 10 KHz     | 10,000    | 100ms
 4   | CyberCore        | 15 KHz     | 15,000    | 66ms
 5   | Singularity      | 22 KHz     | 22,000    | 45ms
 6   | Event Horizon    | 33 KHz     | 33,000    | 30ms
 7   | Dark Matter      | 50 KHz     | 50,000    | 20ms
 8   | Void Engine      | 75 KHz     | 75,000    | 13ms
 9   | Omega Prime      | 100 KHz    | 100,000   | 10ms
 10  | Tesseract        | 150 KHz    | 150,000   | 6.6ms
 11  | Infinity Core    | 220 KHz    | 220,000   | 4.5ms
 12  | Multiverse       | 330 KHz    | 330,000   | 3ms
 13  | Reality Bender   | 500 KHz    | 500,000   | 2ms
 14  | Time Lord        | 750 KHz    | 750,000   | 1.3ms
 15  | Omniscient       | 1 MHz      | 1,000,000 | 1ms
 16  | GOD MODE X       | 1.5 MHz    | 1,500,000 | 0.66ms
══════════════════════════════════════════════════════════════
```

### Ciclos por Instrucción
```javascript
INSTRUCTION_CYCLES = {
  LOAD_CONST: 1,
  ADD/SUB: 1,
  MUL: 2,
  DIV/MOD: 4,
  GET_ELEMENT: 3,
  GET_PROPERTY: 3,
  CALL_NATIVE: 10,  // I/O operations son más costosas
  // ...
}
```

### Optimización Windows setTimeout
Windows tiene resolución mínima de ~15.6ms para setTimeout. La VM acumula ciclos y solo hace delay real cada 16ms para evitar overhead.

```javascript
// Fórmula: delayMs = (1000 / cpuSpeed) * accumulatedCycles
// Solo delay cuando accumulated >= 16ms
```

---

## 🔪 Sistema de Kill de Procesos

### Flujo de Kill
```
1. Usuario ejecuta: kill <pid>
2. io-handler.killProcess() busca el proceso
3. workerPool.killCommand(computerId, pid) envía señal de abort
4. Worker recibe 'abort' message → vm.aborted = true
5. VM verifica aborted flag cada instrucción
6. VM retorna con exitCode: 137 y "[Killed]" en output
7. Process se elimina de MongoDB
```

### Tracking de Comandos Activos
```javascript
// worker-pool.js
activeCommands = Map<"computerId:pid", { worker, aborted }>
```

---

## 💾 Sistema de Discos y Almacenamiento

### Modelo Computer.hardware.disks
```javascript
disks: [{
  id: 'disk0',
  device: 'sda',
  name: 'Samsung SSD 980 PRO',
  type: 'ssd' | 'hdd' | 'nvme' | 'usb',
  capacity: 102400,  // MB (100 GB)
  speed: 550,        // MB/s
  partitions: [{
    device: 'sda1',
    mountPoint: '/',
    size: 102400,
    filesystem: 'ext4'
  }]
}]
```

### Comando df (Disk Free)
```bash
df
# Output:
# Filesystem      Size    Used    Avail   Use%   Mounted on
# /dev/sda1       100GB   2.5GB   97.5GB  2.5%   /
```

---

## 🌐 WebSocket Streaming

### Eventos Terminal
```typescript
// Cliente se conecta y une a room de su computerId
socket.emit('terminal:join', { computerId });

// Servidor emite output línea por línea
socket.on('terminal:output', { commandId, line, timestamp });
```

### Bloqueo de Input
```typescript
// Frontend: TerminalContent.tsx
const [isExecuting, setIsExecuting] = useState(false);
// Oculta prompt mientras se ejecuta comando
```

---

## 🎯 Comandos Implementados

| Comando | Descripción | Bytecode |
|---------|-------------|----------|
| `ls [dir]` | Listar directorio | ✅ |
| `cd <dir>` | Cambiar directorio | ✅ |
| `pwd` | Directorio actual | ✅ |
| `cat <file>` | Ver contenido | ✅ |
| `touch <file>` | Crear archivo vacío | ✅ |
| `rm <file>` | Eliminar archivo | ✅ |
| `mkdir <dir>` | Crear directorio | ✅ |
| `rmdir <dir>` | Eliminar directorio | ✅ |
| `cp <src> <dst>` | Copiar archivo | ✅ |
| `mv <src> <dst>` | Mover archivo | ✅ |
| `echo <text>` | Imprimir texto | ✅ |
| `ps` | Listar procesos | ✅ |
| `kill <pid>` | Matar proceso | ✅ |
| `df` | Uso de disco | ✅ |
| `clear` | Limpiar terminal | ✅ |
| `megaecho <n>` | Echo N líneas (test) | ✅ |
| `fillme` | Llenar disco (test) | ✅ |
| `>` / `>>` | Redirección output | ✅ |

---

## ✅ Funcionalidades Implementadas

### Sistema Base
- [x] Registro e inicio de sesión
- [x] Desktop con grid background y scan effect
- [x] Window manager (drag, resize, minimize, maximize, close)
- [x] Taskbar con ventanas minimizadas
- [x] Start menu
- [x] Reset PC (con logout automático)

### Terminal y VM
- [x] Syscript compiler (source → bytecode)
- [x] VM en Worker Threads (ejecución paralela)
- [x] Worker Pool (4 workers reutilizables)
- [x] Sistema de CPU Speed (17 tiers)
- [x] WebSocket streaming de output
- [x] Kill real de procesos (abort signal)
- [x] Input blocking durante ejecución
- [x] Timeout con reset por actividad (30s)
- [x] Cleanup automático en nodemon restart

### Filesystem
- [x] Navegación por directorios
- [x] CRUD de archivos y carpetas
- [x] Sistema de permisos (755, 644)
- [x] Directorios protegidos
- [x] Sistema de discos con particiones
- [x] Cálculo de uso de disco

### Aplicaciones GUI
- [x] File Manager (con context menu)
- [x] Text Editor
- [x] System Monitor
- [x] Terminal

---

## 🔜 Próximas Funcionalidades

### 🔴 Alta Prioridad - Gameplay Core

#### 1. Network Scanner
```
scan                    # Escanear red local
scan -p <ip>           # Escanear puertos de IP
```
- Modelo Network con IPs disponibles
- NPCs con servidores hackeables
- Puertos abiertos/cerrados

#### 2. SSH Client
```
ssh <ip>               # Conectar a máquina remota
ssh user@ip            # Con usuario específico
```
- Cambio de contexto (computer actual)
- Prompt muestra hostname remoto
- Comandos ejecutan en máquina remota

#### 3. Sistema de Passwords y Cracking
```
crack <hash>           # Intentar crackear hash
crack -w wordlist.txt  # Con wordlist
```
- Archivos /etc/passwd en servidores
- Diferentes niveles de encriptación
- Wordlists como items comprables

#### 4. Sistema de Logs
```
/var/log/auth.log      # Logs de conexiones
/var/log/access.log    # Logs de acceso a archivos
```
- Logs se generan automáticamente
- El jugador debe borrarlos para no ser rastreado
- Traces llevan a game over si no se limpian

### 🟡 Media Prioridad - Progresión

#### 5. Sistema de Dinero y Tienda
- Moneda del juego (credits)
- Vender datos robados
- Comprar: CPUs, RAM, herramientas, exploits

#### 6. Misiones y NPCs
- Mission board (trabajos de hacking)
- NPCs que dan misiones
- Reputación con facciones

#### 7. Exploits y Vulnerabilidades
```
exploit -l              # Listar exploits disponibles
exploit CVE-2024-XXX    # Ejecutar exploit
```
- Exploits como items
- Vulnerabilidades en servidores NPC
- Diferentes niveles de dificultad

### 🟢 Baja Prioridad - Polish

#### 8. Mail Client
- Recibir misiones por email
- Comunicación con NPCs

#### 9. Bank System
- Cuentas bancarias (propias y de NPCs)
- Transferencias
- Lavado de dinero

#### 10. Proxy Chains
```
proxy add <ip>          # Agregar proxy a cadena
proxy clear             # Limpiar cadena
```
- Ocultar origen de conexiones
- Más proxies = más seguro pero más lento

---

## 📊 Roadmap Sugerido

### Fase 1: Network Basics
1. Modelo Network con IPs
2. Comando `scan` básico
3. NPCs con servidores simples
4. Comando `ssh` para conectar

### Fase 2: Hacking Loop
1. Sistema de logs
2. Archivos valiosos en servidores
3. Comando `download` para robar
4. Detección y traces

### Fase 3: Economía
1. Sistema de créditos
2. Tienda de hardware
3. Misiones básicas
4. Venta de datos

### Fase 4: Profundidad
1. Exploits y vulnerabilidades
2. Cracking de passwords
3. Proxy chains
4. Bancos

---

## 🗓️ Historial de Sesiones

### Sesión 2026-01-05
**Implementado:**
- Worker Threads para VM (ejecución paralela)
- Worker Pool con 4 workers reutilizables
- Sistema de CPU Speed con 17 tiers
- Optimización setTimeout batching para Windows
- Kill real de procesos (abort signal al worker)
- WebSocket streaming de output
- Input blocking durante ejecución
- Timeout con reset por actividad
- Cleanup automático para nodemon
- Comandos: kill, df, megaecho, fillme
- Sistema de discos con particiones
- Reset PC hace logout automático

**Archivos creados/modificados:**
- `backend-auth/src/syscript/vm-worker.js` - VM en worker thread
- `backend-auth/src/syscript/worker-pool.js` - Pool manager
- `backend-auth/src/syscript/io-handler.js` - I/O operations
- `backend-auth/src/services/socketService.js` - WebSocket
- `backend-auth/src/controllers/terminalController.js` - Usa workers
- `frontend-game/src/components/TerminalContent.tsx` - Streaming + blocking
- `frontend-game/src/pages/Desktop.tsx` - Reset + logout

### Sesión 2026-01-04
**Implementado:**
- Sistema Syscript completo (compiler + VM)
- Soporte para: for, while, if/else, variables tipadas
- Native APIs: Console, File, Process
- Comandos básicos: ls, cd, pwd, cat, ps, etc.
- Redirección de output (>, >>)

### Sesión 2025-10-10
**Implementado:**
- Context menu en File Manager y Desktop
- DELETE endpoint con protección
- ConfirmDialog component
- Auto-sync de filesystem events

---

## 💡 Notas Técnicas

### Windows setTimeout Issue
Windows tiene timer resolution de ~15.6ms. Para simular CPU speeds correctamente, la VM acumula ciclos y solo hace setTimeout cuando accumulated delay >= 16ms.

### Worker Thread Cleanup
Al recibir SIGTERM/SIGINT/SIGUSR2 (nodemon), el pool hace shutdown de todos los workers para evitar EADDRINUSE en restart.

### IPC para I/O
Las operaciones de I/O (File.Read, File.Write, etc.) requieren acceso a MongoDB, que solo está disponible en el main thread. El worker envía mensaje 'io-request' y espera 'io-response'.

---

**Última actualización**: 2026-01-05
**Versión del juego**: Alpha 0.4

> "La velocidad de tu CPU determina qué tan rápido puedes hackear. Invierte sabiamente." 👾
