# Syscript Bytecode & VM Documentation

> Última actualización: 2026-01-04

## Índice

1. [Overview](#overview)
2. [Sintaxis del Lenguaje](#sintaxis-del-lenguaje)
3. [Bytecode Format](#bytecode-format)
4. [Opcodes](#opcodes)
5. [Native APIs](#native-apis)
6. [Patrones Comunes](#patrones-comunes)
7. [Comandos Implementados](#comandos-implementados)
8. [Stack Machine](#stack-machine)
9. [Guía: Crear nuevo comando](#guía-crear-nuevo-comando)
10. [Archivos del Sistema](#archivos-del-sistema)

---

## Overview

**Syscript** es el lenguaje de scripting propietario del juego HackerGame. Tiene sintaxis similar a C# pero es procedural (sin clases).

### Flujo de compilación

```
┌─────────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│ .syscript   │───▶│  Lexer  │───▶│ Parser  │───▶│ Compiler │
│ (source)    │    │ tokens  │    │   AST   │    │ bytecode │
└─────────────┘    └─────────┘    └─────────┘    └──────────┘
                                                       │
                                                       ▼
                                                ┌──────────┐
                                                │    VM    │
                                                │ ejecuta  │
                                                └──────────┘
```

### Características del lenguaje

- Entry point obligatorio: `void Main(string[] args) { }`
- Tipos: `void`, `int`, `string`, `bool`, `float`, arrays (`string[]`, `int[]`)
- Comentarios: `//` línea, `/* */` bloque
- Sin clases ni objetos (procedural)

---

## Sintaxis del Lenguaje

### Tipos de datos

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `int` | Entero | `42`, `-10` |
| `float` | Decimal | `3.14`, `0.5` |
| `string` | Cadena de texto | `"hello"`, `'world'` |
| `bool` | Booleano | `true`, `false` |
| `null` | Valor nulo | `null` |
| `int[]` | Array de enteros | `{1, 2, 3}` |
| `string[]` | Array de strings | `{"a", "b"}` |

### Declaración de variables

```csharp
// Declaración simple
int count;
string name;
string[] items;

// Declaración con inicialización
int x = 10;
string greeting = "Hello";
string[] files = File.List(null);
```

### Operadores

#### Aritméticos
| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `+` | Suma / Concatenación | `a + b`, `"hi" + " there"` |
| `-` | Resta | `a - b` |
| `*` | Multiplicación | `a * b` |
| `/` | División | `a / b` |
| `%` | Módulo | `a % b` |

#### Comparación
| Operador | Descripción |
|----------|-------------|
| `==` | Igual |
| `!=` | No igual |
| `<` | Menor que |
| `>` | Mayor que |
| `<=` | Menor o igual |
| `>=` | Mayor o igual |

#### Lógicos
| Operador | Descripción |
|----------|-------------|
| `&&` | AND lógico |
| `\|\|` | OR lógico |
| `!` | NOT lógico |

### Control de flujo

#### if / else
```csharp
if (condition) {
    // código si verdadero
}

if (x > 0) {
    Console.Log("Positivo");
} else {
    Console.Log("No positivo");
}
```

#### for loop
```csharp
for (int i = 0; i < items.Length; i = i + 1) {
    Console.Log(items[i].name);
}
```

#### while loop
```csharp
int i = 0;
while (i < 10) {
    Console.Log(i);
    i = i + 1;
}
```

### Acceso a propiedades y arrays

```csharp
// Acceso a array
string first = args[0];
string second = items[1];

// Acceso a propiedad
string fileName = items[i].name;
string fileType = items[i].type;

// Longitud de array
int count = args.Length;

// Encadenado
string name = files[i].name;
```

### Funciones nativas

```csharp
// Llamadas a APIs nativas
Console.Log("Hello");
string cwd = Console.GetWorkingDir();
string[] files = File.List(null);
string content = File.Read("file.txt");
string[] procs = Process.List();
```

---

## Bytecode Format

El bytecode se almacena como JSON para facilitar debugging:

```json
{
  "version": "1.0",
  "constants": [],
  "instructions": []
}
```

### Campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `version` | string | Versión del formato bytecode |
| `constants` | array | Pool de constantes (strings, números, null, booleanos) |
| `instructions` | array | Array de instrucciones, cada una es `[opcode, ...operands]` |

### Ejemplo

```json
{
  "version": "1.0",
  "constants": [0, "Hello World"],
  "instructions": [
    [1, 1],
    [64, 256],
    [80]
  ]
}
```

Esto equivale a:
```csharp
void Main(string[] args) {
    Console.Log("Hello World");
}
```

---

## Opcodes

### Tabla completa de Opcodes

#### Stack Operations (0x01-0x0F)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 1 | 0x01 | LOAD_CONST | index | `[...] → [..., constants[index]]` | Carga constante del pool |
| 2 | 0x02 | LOAD_ARG | index | `[...] → [..., args]` | Carga array de argumentos (index=0) |
| 3 | 0x03 | STORE_LOCAL | index | `[..., value] → [...]` | Guarda valor en variable local |
| 4 | 0x04 | LOAD_LOCAL | index | `[...] → [..., locals[index]]` | Carga variable local |

#### Array/Object Operations (0x10-0x17)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 16 | 0x10 | GET_LENGTH | - | `[..., array] → [..., length]` | Obtiene longitud de array |
| 17 | 0x11 | GET_ELEMENT | - | `[..., array, index] → [..., element]` | Obtiene elemento de array |
| 18 | 0x12 | GET_PROPERTY | propIdx | `[..., obj] → [..., obj[prop]]` | Obtiene propiedad de objeto |

#### Arithmetic Operations (0x18-0x1F)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 24 | 0x18 | ADD | - | `[..., a, b] → [..., a+b]` | Suma / Concatenación |
| 25 | 0x19 | SUB | - | `[..., a, b] → [..., a-b]` | Resta |
| 26 | 0x1A | MUL | - | `[..., a, b] → [..., a*b]` | Multiplicación |
| 27 | 0x1B | DIV | - | `[..., a, b] → [..., a/b]` | División |
| 28 | 0x1C | MOD | - | `[..., a, b] → [..., a%b]` | Módulo |
| 29 | 0x1D | NEG | - | `[..., a] → [..., -a]` | Negación |

#### Comparison Operations (0x20-0x27)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 32 | 0x20 | EQ | - | `[..., a, b] → [..., bool]` | Igual (===) |
| 33 | 0x21 | NEQ | - | `[..., a, b] → [..., bool]` | No igual (!==) |
| 34 | 0x22 | LT | - | `[..., a, b] → [..., bool]` | Menor que (<) |
| 35 | 0x23 | GT | - | `[..., a, b] → [..., bool]` | Mayor que (>) |
| 36 | 0x24 | LTE | - | `[..., a, b] → [..., bool]` | Menor o igual (<=) |
| 37 | 0x25 | GTE | - | `[..., a, b] → [..., bool]` | Mayor o igual (>=) |

#### Logical Operations (0x28-0x2F)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 40 | 0x28 | NOT | - | `[..., a] → [..., !a]` | NOT lógico |
| 41 | 0x29 | AND | - | `[..., a, b] → [..., a&&b]` | AND lógico |
| 42 | 0x2A | OR | - | `[..., a, b] → [..., a\|\|b]` | OR lógico |

#### Control Flow (0x30-0x3F)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 48 | 0x30 | JUMP_IF_FALSE | offset | `[..., cond] → [...]` | Salta si condición es false |
| 49 | 0x31 | JUMP | offset | `[...] → [...]` | Salto incondicional |

#### Native Calls (0x40-0x4F)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 64 | 0x40 | CALL_NATIVE | apiId | Depende de la API | Llama función nativa |

#### Function Control (0x50-0x5F)

| Dec | Hex | Nombre | Operandos | Stack (antes → después) | Descripción |
|-----|-----|--------|-----------|-------------------------|-------------|
| 80 | 0x50 | RETURN | - | - | Termina ejecución |

### Detalle de cada Opcode

#### LOAD_CONST (0x01)

Carga una constante del pool al stack.

```
Instrucción: [1, index]
Ejemplo:     [1, 0]  // Push constants[0]

constants: ["hello", 42, null]
[1, 0] → push "hello"
[1, 1] → push 42
[1, 2] → push null
```

#### LOAD_ARG (0x02)

Carga el array de argumentos de la función Main al stack.

```
Instrucción: [2, index]
Ejemplo:     [2, 0]  // Push args (el array completo de argumentos)

Nota: LOAD_ARG 0 carga el array completo de argumentos del comando.
      Para obtener el primer argumento del usuario, usar:
      LOAD_ARG 0 → LOAD_CONST 0 → GET_ELEMENT
```

#### STORE_LOCAL (0x03)

Guarda el valor del top del stack en una variable local.

```
Instrucción: [3, index]
Ejemplo:     [3, 0]  // Pop valor, guardar en locals[0]

Stack:       [..., value] → [...]
```

#### LOAD_LOCAL (0x04)

Carga el valor de una variable local al stack.

```
Instrucción: [4, index]
Ejemplo:     [4, 0]  // Push locals[0]

Stack:       [...] → [..., locals[index]]
```

#### GET_LENGTH (0x10)

Obtiene la longitud de un array.

```
Instrucción: [16]
Stack:       [..., array] → [..., length]

Ejemplo:
  args = ["file.txt", "-v"]
  [2, 0]   // push args → [..., ["file.txt", "-v"]]
  [16]     // get length → [..., 2]
```

#### GET_ELEMENT (0x11)

Obtiene un elemento de un array por índice.

```
Instrucción: [17]
Stack:       [..., array, index] → [..., element]

Ejemplo:
  [2, 0]   // push args → [..., ["file.txt", "-v"]]
  [1, 0]   // push 0 → [..., ["file.txt", "-v"], 0]
  [17]     // get element → [..., "file.txt"]
```

#### GET_PROPERTY (0x12)

Obtiene una propiedad de un objeto.

```
Instrucción: [18, propNameIndex]
Stack:       [..., object] → [..., object[propName]]

Ejemplo (items[i].name):
  [4, 0]   // push items (locals[0])
  [4, 1]   // push i (locals[1])
  [17]     // get element → items[i]
  [18, 7]  // get property "name" (constants[7])
```

#### ADD (0x18)

Suma dos valores o concatena strings.

```
Instrucción: [24]
Stack:       [..., a, b] → [..., a + b]

Ejemplo numérico:
  [1, 0]   // push 5
  [1, 1]   // push 3
  [24]     // add → [..., 8]

Ejemplo concatenación:
  [1, 0]   // push "Hello"
  [1, 1]   // push " World"
  [24]     // add → [..., "Hello World"]
```

#### LT (0x22)

Compara si a < b.

```
Instrucción: [34]
Stack:       [..., a, b] → [..., bool]

Ejemplo (i < items.Length):
  [4, 1]   // push i
  [4, 0]   // push items
  [16]     // get length
  [34]     // lt → [..., true/false]
```

#### EQ (0x20)

Compara dos valores por igualdad estricta.

```
Instrucción: [32]
Stack:       [..., a, b] → [..., bool]

Ejemplo:
  [1, 0]   // push 5
  [1, 1]   // push 5
  [32]     // eq → [..., true]
```

#### JUMP_IF_FALSE (0x30)

Salta a una instrucción si el valor en el stack es false.

```
Instrucción: [48, offset]
Stack:       [..., condition] → [...]

Ejemplo:
  [32]       // resultado de comparación en stack
  [48, 10]   // si false, saltar a instrucción 10
             // si true, continuar a siguiente instrucción
```

#### JUMP (0x31)

Salto incondicional.

```
Instrucción: [49, offset]
Stack:       sin cambios

Ejemplo:
  [49, 15]   // saltar a instrucción 15
```

#### CALL_NATIVE (0x40)

Llama una función nativa del sistema.

```
Instrucción: [64, apiId]
Stack:       depende de la función

Ejemplo:
  [1, 0]      // push "Hello"
  [64, 256]   // Console.Log → imprime "Hello"
```

#### RETURN (0x50)

Termina la ejecución del programa.

```
Instrucción: [80]
Stack:       sin cambios (termina ejecución)
```

---

## Native APIs

### Resumen por categoría

| Categoría | Rango Hex | Descripción |
|-----------|-----------|-------------|
| Console | 0x0100 - 0x01FF | Entrada/salida de consola |
| File | 0x0200 - 0x02FF | Operaciones de archivos |
| Process | 0x0300 - 0x03FF | Gestión de procesos |
| Device | 0x0400 - 0x04FF | Operaciones de red/hacking (futuro) |
| System | 0x0500 - 0x05FF | Sistema operativo (futuro) |

### Console APIs (0x01xx)

| Dec | Hex | Nombre | Stack In | Stack Out | Estado | Descripción |
|-----|-----|--------|----------|-----------|--------|-------------|
| 256 | 0x0100 | Console.Log | message | - | ✅ Impl | Imprime mensaje a terminal |
| 257 | 0x0101 | Console.ChangeDir | path | - | ✅ Impl | Cambia directorio de trabajo |
| 258 | 0x0102 | Console.GetWorkingDir | - | cwd | ✅ Impl | Retorna directorio actual |
| 259 | 0x0103 | Console.Clear | - | - | ❌ Pending | Limpia la terminal |
| 260 | 0x0104 | Console.Exit | exitCode | - | ❌ Pending | Termina con código de salida |

### File APIs (0x02xx)

| Dec | Hex | Nombre | Stack In | Stack Out | Estado | Descripción |
|-----|-----|--------|----------|-----------|--------|-------------|
| 512 | 0x0200 | File.Read | path | content | ✅ Impl | Lee contenido de archivo |
| 513 | 0x0201 | File.Write | path, content | - | ✅ Impl | Escribe/sobrescribe archivo |
| 514 | 0x0202 | File.Append | path, content | - | ✅ Impl | Agrega contenido al final |
| 515 | 0x0203 | File.Delete | path | - | ✅ Impl | Elimina archivo |
| 516 | 0x0204 | File.Exists | path | bool | ✅ Impl | Verifica si archivo existe |
| 517 | 0x0205 | File.List | path | items[] | ✅ Impl | Lista contenido de directorio |
| 518 | 0x0206 | File.Create | path | - | ✅ Impl | Crea archivo vacío (touch) |
| 519 | 0x0207 | File.MakeDir | path | - | ✅ Impl | Crea directorio |
| 520 | 0x0208 | File.RemoveDir | path | - | ✅ Impl | Elimina directorio vacío |

### Process APIs (0x03xx)

| Dec | Hex | Nombre | Stack In | Stack Out | Estado | Descripción |
|-----|-----|--------|----------|-----------|--------|-------------|
| 768 | 0x0300 | Process.List | - | procs[] | ✅ Impl | Lista procesos del sistema |
| 769 | 0x0301 | Process.Kill | pid | bool | ❌ Pending | Mata un proceso por PID |

### Device APIs (0x04xx) - FUTURO

| Dec | Hex | Nombre | Stack In | Stack Out | Estado | Descripción |
|-----|-----|--------|----------|-----------|--------|-------------|
| 1024 | 0x0400 | Device.Scan | - | ips[] | ❌ Planned | Escanea red por IPs |
| 1025 | 0x0401 | Device.Connect | ip, port | handle | ❌ Planned | Conecta a dispositivo |
| 1026 | 0x0402 | Device.Exec | handle, cmd | output | ❌ Planned | Ejecuta comando remoto |
| 1027 | 0x0403 | Device.Disconnect | handle | - | ❌ Planned | Desconecta de dispositivo |

### Detalle de APIs implementadas

#### Console.Log (0x0100 = 256)

Imprime un mensaje a la salida de la terminal.

```
Stack: [..., message] → [...]
Efecto: Agrega message al output de la VM
```

#### Console.ChangeDir (0x0101 = 257)

Cambia el directorio de trabajo actual.

```
Stack: [..., path] → [...]
Efecto: Actualiza workingDir en la sesión
Errores: "cd: <path>: No such file or directory"
```

#### Console.GetWorkingDir (0x0102 = 258)

Obtiene el directorio de trabajo actual.

```
Stack: [...] → [..., cwd]
Retorna: String con path absoluto (ej: "/home/user")
```

#### File.Read (0x0200 = 512)

Lee el contenido de un archivo.

```
Stack: [..., path] → [..., content]
Retorna: String con contenido del archivo
Errores:
  - "cat: <path>: No such file or directory"
  - "cat: <path>: Is a directory"
```

#### File.Write (0x0201 = 513)

Escribe contenido a un archivo (sobrescribe si existe).

```
Stack: [..., path, content] → [...]
Crea el archivo si no existe.
Errores:
  - "write: <path>: No such directory"
  - "write: <path>: Is a directory"
```

**Ejemplo Syscript:**
```csharp
File.Write("log.txt", "Hello World");
```

#### File.Append (0x0202 = 514)

Agrega contenido al final de un archivo.

```
Stack: [..., path, content] → [...]
Crea el archivo si no existe.
```

**Ejemplo Syscript:**
```csharp
File.Append("log.txt", "\nNew line");
```

#### File.Delete (0x0203 = 515)

Elimina un archivo.

```
Stack: [..., path] → [...]
Errores:
  - "rm: <path>: No such file or directory"
  - "rm: <path>: Is a directory"
```

**Ejemplo Syscript:**
```csharp
File.Delete("temp.txt");
```

#### File.Exists (0x0204 = 516)

Verifica si un archivo existe.

```
Stack: [..., path] → [..., bool]
Retorna: true si existe, false si no
```

**Ejemplo Syscript:**
```csharp
if (File.Exists("config.txt")) {
    string config = File.Read("config.txt");
}
```

#### File.List (0x0205 = 517)

Lista el contenido de un directorio.

```
Stack: [..., path] → [..., items[]]
Input: path (string) o null para directorio actual
Retorna: Array de objetos:
  [{name: "file.txt", type: "-", size: 1024}, ...]
  type: "d" = directorio, "-" = archivo
```

#### File.Create (0x0206 = 518)

Crea un archivo vacío (equivalente a `touch`).

```
Stack: [..., path] → [...]
Si el archivo ya existe, solo actualiza la fecha de modificación.
```

**Ejemplo Syscript:**
```csharp
File.Create("newfile.txt");
```

#### Process.List (0x0300 = 768)

Lista los procesos del sistema.

```
Stack: [...] → [..., procs[]]
Retorna: Array de objetos:
  [{pid: 1, name: "init", user: "root", cpu: 0.1, mem: 1.2, status: "running", type: "system", port: null, protected: true}, ...]
```

**Propiedades de cada proceso:**

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `pid` | int | ID del proceso |
| `name` | string | Nombre del proceso |
| `user` | string | Usuario dueño |
| `cpu` | float | % uso de CPU |
| `mem` | float | % uso de memoria |
| `status` | string | "running", "stopped", etc. |
| `type` | string | "system", "service", "user" |
| `port` | int/null | Puerto si es servicio de red |
| `protected` | bool | Si es proceso protegido del sistema |

---

## Patrones Comunes

### Patrón 1: Verificar argumentos requeridos

**Uso:** Comandos que requieren al menos un argumento (`cd`, `cat`)

**Código fuente:**
```csharp
if (args.Length == 0) {
    Console.Log("error: missing operand");
    return;
}
```

**Bytecode:**
```json
{
  "constants": [0, "error: missing operand"],
  "instructions": [
    [2, 0],      // 0: LOAD_ARG 0 → push args
    [16],        // 1: GET_LENGTH → push args.length
    [1, 0],      // 2: LOAD_CONST 0 → push 0
    [32],        // 3: EQ → push (length == 0)
    [48, 8],     // 4: JUMP_IF_FALSE 8 → si hay args, saltar
    [1, 1],      // 5: LOAD_CONST 1 → push mensaje error
    [64, 256],   // 6: CALL_NATIVE Console.Log
    [80],        // 7: RETURN
    // 8: continúa aquí si hay argumentos...
  ]
}
```

### Patrón 2: Obtener primer argumento

**Uso:** Extraer `args[0]` después de verificar que existe

**Bytecode:**
```json
[2, 0],      // LOAD_ARG 0 → push args
[1, 0],      // LOAD_CONST 0 → push 0 (índice)
[17],        // GET_ELEMENT → push args[0]
```

### Patrón 3: Argumento opcional (null si no existe)

**Uso:** Comandos donde el argumento es opcional (`ls`)

**Código fuente:**
```csharp
string path;
if (args.Length == 0) {
    path = null;  // usar directorio actual
} else {
    path = args[0];
}
```

**Bytecode:**
```json
{
  "constants": [0, null],
  "instructions": [
    [2, 0],      // 0: LOAD_ARG 0
    [16],        // 1: GET_LENGTH
    [1, 0],      // 2: LOAD_CONST 0 (valor 0)
    [32],        // 3: EQ
    [48, 8],     // 4: JUMP_IF_FALSE 8
    [1, 1],      // 5: LOAD_CONST 1 (null)
    [49, 11],    // 6: JUMP 11
    [2, 0],      // 7: (padding)
    [2, 0],      // 8: LOAD_ARG 0
    [1, 0],      // 9: LOAD_CONST 0
    [17],        // 10: GET_ELEMENT
    // 11: path está en el stack
  ]
}
```

### Patrón 4: Comando sin argumentos

**Uso:** Comandos simples que no requieren input (`pwd`, `clear`)

**Bytecode:**
```json
{
  "constants": [],
  "instructions": [
    [64, 258],   // CALL_NATIVE (ej: GetWorkingDir)
    [64, 256],   // CALL_NATIVE Console.Log (si hay que imprimir)
    [80]         // RETURN
  ]
}
```

### Patrón 5: Leer y mostrar

**Uso:** Leer algo y mostrarlo (`cat`, `pwd`)

**Bytecode:**
```json
// ... obtener path ...
[64, 512],   // File.Read → push contenido
[64, 256],   // Console.Log → imprime
[80]         // RETURN
```

---

## Comandos Implementados

### cd - Change Directory

| Propiedad | Valor |
|-----------|-------|
| Ubicación binario | `/bin/cd` |
| Ubicación source | `/usr/src/cd.syscript` |
| Patrón | 1 (requiere argumento) + ChangeDir |
| APIs usadas | Console.Log, Console.ChangeDir |

**Source:**
```csharp
void Main(string[] args) {
    if (args.Length == 0) {
        Console.Log("cd: missing operand");
        return;
    }
    Console.ChangeDir(args[0]);
}
```

**Bytecode:**
```json
{
  "version": "1.0",
  "constants": ["cd: missing operand", 0],
  "instructions": [
    [2, 0], [16], [1, 1], [32], [48, 8],
    [1, 0], [64, 256], [80],
    [2, 0], [1, 1], [17], [64, 257], [80]
  ]
}
```

---

### ls - List Directory

| Propiedad | Valor |
|-----------|-------|
| Ubicación binario | `/bin/ls` |
| Ubicación source | `/usr/src/ls.syscript` |
| Patrón | 3 (argumento opcional) + for loop |
| APIs usadas | File.List, Console.Log |

**Source:**
```csharp
void Main(string[] args) {
    string[] items;

    if (args.Length == 0) {
        items = File.List(null);
    } else {
        items = File.List(args[0]);
    }

    if (items.Length == 0) {
        return;
    }

    for (int i = 0; i < items.Length; i = i + 1) {
        string icon;
        if (items[i].type == "d") {
            icon = "📁";
        } else {
            icon = "📄";
        }
        string line = icon + " " + items[i].name;
        Console.Log(line);
    }
}
```

**Características:**
- Usa for loop para iterar sobre items
- Accede a propiedades de objetos (`items[i].type`, `items[i].name`)
- Usa concatenación de strings para formatear output
- Soporte para if/else para determinar icono

**Output ejemplo:**
```
📁 Desktop
📁 Documents
📄 readme.txt
📄 script.sc
```

---

### ps - List Processes

| Propiedad | Valor |
|-----------|-------|
| Ubicación binario | `/bin/ps` |
| Ubicación source | `/usr/src/ps.syscript` |
| Patrón | 4 (sin argumentos) + for loop |
| APIs usadas | Process.List, Console.Log |

**Source:**
```csharp
void Main(string[] args) {
    string[] procs = Process.List();

    if (procs.Length == 0) {
        Console.Log("No processes running");
        return;
    }

    Console.Log("  PID  USER       STATUS     COMMAND");
    Console.Log("─────────────────────────────────────────");

    for (int i = 0; i < procs.Length; i = i + 1) {
        string line = "  " + procs[i].pid + "  " + procs[i].user + "  " + procs[i].status + "  " + procs[i].name;
        Console.Log(line);
    }
}
```

**Output ejemplo:**
```
  PID  USER       STATUS     COMMAND
─────────────────────────────────────────
  1  root  running  init
  2  root  running  sshd
  3  user  running  terminal
```

---

### pwd - Print Working Directory

| Propiedad | Valor |
|-----------|-------|
| Ubicación binario | `/bin/pwd` |
| Ubicación source | `/usr/src/pwd.syscript` |
| Patrón | 4 (sin argumentos) |
| APIs usadas | Console.GetWorkingDir, Console.Log |

**Source:**
```csharp
void Main(string[] args) {
    string cwd = Console.GetWorkingDir();
    Console.Log(cwd);
}
```

**Bytecode:**
```json
{
  "version": "1.0",
  "constants": [],
  "instructions": [
    [64, 258], [64, 256], [80]
  ]
}
```

**Output ejemplo:**
```
/home/user
```

---

### cat - Concatenate/Display File

| Propiedad | Valor |
|-----------|-------|
| Ubicación binario | `/bin/cat` |
| Ubicación source | `/usr/src/cat.syscript` |
| Patrón | 1 (requiere argumento) + File.Read |
| APIs usadas | Console.Log, File.Read |

**Source:**
```csharp
void Main(string[] args) {
    if (args.Length == 0) {
        Console.Log("cat: missing file operand");
        return;
    }
    string content = File.Read(args[0]);
    Console.Log(content);
}
```

**Bytecode:**
```json
{
  "version": "1.0",
  "constants": [0, "cat: missing file operand"],
  "instructions": [
    [2, 0], [16], [1, 0], [32], [48, 8],
    [1, 1], [64, 256], [80],
    [2, 0], [1, 0], [17],
    [64, 512], [64, 256], [80]
  ]
}
```

---

## Stack Machine

La VM de Syscript es una máquina de stack simple.

### Conceptos básicos

```
Stack: [valor1, valor2, valor3]
                            ↑ top (último elemento)

PUSH:   Agrega valor al top
POP:    Remueve y retorna el top
PEEK:   Lee el top sin remover
```

### Operaciones

```
Operación unaria:   [..., a] → [..., resultado]
Operación binaria:  [..., a, b] → [..., resultado]
```

### Ejemplo completo: Ejecución de `pwd`

```
Programa: Console.Log(Console.GetWorkingDir())
Bytecode: [[64, 258], [64, 256], [80]]
WorkingDir: "/home/user"

Step  Instrucción              PC  Stack
----  -----------------------  --  ----------------------
0     (inicio)                 0   []
1     [64, 258] GetWorkingDir  1   ["/home/user"]
2     [64, 256] Log            2   []  → output: "/home/user"
3     [80] RETURN              -   (fin)

Output: "/home/user"
```

### Ejemplo completo: Ejecución de `cat README.md`

```
args = [["README.md"]]
constants = [0, "cat: missing file operand"]

Step  Instrucción         PC  Stack                          Descripción
----  ------------------  --  -----------------------------  -----------
0     (inicio)            0   []
1     [2, 0] LOAD_ARG     1   [["README.md"]]                push args
2     [16] GET_LENGTH     2   [1]                            length = 1
3     [1, 0] LOAD_CONST   3   [1, 0]                         push 0
4     [32] EQ             4   [false]                        1 == 0 → false
5     [48, 8] JUMP_IF_F   8   []                             false → salta a 8
6-7   (saltados)
8     [2, 0] LOAD_ARG     9   [["README.md"]]                push args
9     [1, 0] LOAD_CONST   10  [["README.md"], 0]             push 0
10    [17] GET_ELEMENT    11  ["README.md"]                  args[0]
11    [64, 512] File.Read 12  ["Contenido del archivo..."]   lee archivo
12    [64, 256] Log       13  []                             imprime
13    [80] RETURN         -   (fin)

Output: "Contenido del archivo..."
```

---

## Guía: Crear nuevo comando

### Paso 1: Identificar el patrón

| Si el comando... | Usar patrón |
|------------------|-------------|
| Requiere argumento obligatorio | 1 |
| Argumento opcional | 3 |
| Sin argumentos | 4 |

### Paso 2: Verificar APIs necesarias

Revisar si existe el Native API en `bytecode-format.js`.

Si no existe:

1. **Agregar a `bytecode-format.js`:**
```javascript
const NATIVE_API = {
  // ...
  'MiCategoria.MiFuncion': 0x0XXX,
};
```

2. **Implementar en `vm.js`:**
```javascript
case NATIVE_API['MiCategoria.MiFuncion']: {
  const arg = this.stack.pop();
  // ... lógica ...
  this.stack.push(resultado);  // si retorna algo
  return {};
}
```

### Paso 3: Crear archivos

**Source:** `backend-auth/src/syscript/sources/COMANDO.syscript`
```csharp
// COMANDO - Descripción
// Part of Synapse OS v1.0
//
// Usage: COMANDO [args]
// Descripción detallada.

void Main(string[] args) {
    // código
}
```

**Bytecode:** `backend-auth/src/syscript/binaries/COMANDO-bytecode.json`
```json
{
  "version": "1.0",
  "constants": [],
  "instructions": []
}
```

### Paso 4: Registrar en authController.js

1. **Cargar bytecode:**
```javascript
const comandoBytecode = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../syscript/binaries/COMANDO-bytecode.json'), 'utf8')
);
```

2. **Cargar source:**
```javascript
const comandoSyscriptContent = fs.readFileSync(
  path.join(__dirname, '../syscript/sources/COMANDO.syscript'), 'utf8'
);
```

3. **Agregar a /bin:**
```javascript
'COMANDO': {
  type: 'binary',
  owner: 'root',
  permissions: '755',
  size: JSON.stringify(comandoBytecode).length,
  description: 'Descripción del comando',
  bytecode: comandoBytecode,
  createdAt: new Date(),
  modifiedAt: new Date()
}
```

4. **Agregar source a /usr/src:**
```javascript
'COMANDO.syscript': {
  type: 'source',
  owner: 'root',
  permissions: '644',
  size: Buffer.byteLength(comandoSyscriptContent, 'utf8'),
  content: comandoSyscriptContent,
  createdAt: new Date(),
  modifiedAt: new Date()
}
```

### Paso 5: Probar

1. Reiniciar backend
2. En el juego: Start Menu → Destroy & Reset PC
3. Abrir terminal
4. Ejecutar comando

---

## Archivos del Sistema

### Estructura de directorios

```
backend-auth/src/syscript/
├── bytecode-format.js      # Definición de opcodes y APIs
├── vm.js                   # Virtual Machine
├── compiler.js             # Compilador funcional
├── binaries/               # Bytecode compilado
│   ├── cd-bytecode.json
│   ├── ls-bytecode.json
│   ├── pwd-bytecode.json
│   ├── cat-bytecode.json
│   └── ps-bytecode.json
└── sources/                # Código fuente
    ├── cd.syscript
    ├── ls.syscript
    ├── pwd.syscript
    ├── cat.syscript
    └── ps.syscript
```

### Filesystem del juego

```
/
├── bin/                    # Binarios del sistema
│   ├── ls                  # type: binary, bytecode
│   ├── cd                  # type: binary, bytecode
│   ├── pwd                 # type: binary, bytecode
│   ├── cat                 # type: binary, bytecode
│   └── ps                  # type: binary, bytecode
├── usr/
│   ├── bin/                # Aplicaciones GUI
│   │   ├── terminal
│   │   ├── filemanager
│   │   └── ...
│   └── src/                # Código fuente
│       ├── cd.syscript
│       ├── ls.syscript
│       ├── ps.syscript
│       └── ...
├── home/
│   └── {username}/
│       ├── Desktop/
│       ├── README.md
│       └── ...
└── etc/
    └── hostname
```

---

## Referencia Rápida

### Opcodes

| Dec | Hex | Nombre | Uso rápido |
|-----|-----|--------|------------|
| 1 | 0x01 | LOAD_CONST | `[1, idx]` push constant |
| 2 | 0x02 | LOAD_ARG | `[2, 0]` push args |
| 3 | 0x03 | STORE_LOCAL | `[3, idx]` pop → locals[idx] |
| 4 | 0x04 | LOAD_LOCAL | `[4, idx]` push locals[idx] |
| 16 | 0x10 | GET_LENGTH | `[16]` array.length |
| 17 | 0x11 | GET_ELEMENT | `[17]` array[idx] |
| 18 | 0x12 | GET_PROPERTY | `[18, propIdx]` obj.prop |
| 24 | 0x18 | ADD | `[24]` a + b |
| 25 | 0x19 | SUB | `[25]` a - b |
| 26 | 0x1A | MUL | `[26]` a * b |
| 27 | 0x1B | DIV | `[27]` a / b |
| 32 | 0x20 | EQ | `[32]` a == b |
| 33 | 0x21 | NEQ | `[33]` a != b |
| 34 | 0x22 | LT | `[34]` a < b |
| 35 | 0x23 | GT | `[35]` a > b |
| 48 | 0x30 | JUMP_IF_FALSE | `[48, offset]` |
| 49 | 0x31 | JUMP | `[49, offset]` |
| 64 | 0x40 | CALL_NATIVE | `[64, apiId]` |
| 80 | 0x50 | RETURN | `[80]` fin |

### APIs más usadas

| Dec | Nombre | Uso |
|-----|--------|-----|
| 256 | Console.Log | Imprimir mensaje |
| 257 | Console.ChangeDir | cd |
| 258 | Console.GetWorkingDir | pwd |
| 512 | File.Read | Leer archivo |
| 513 | File.Write | Escribir archivo |
| 514 | File.Append | Agregar a archivo |
| 515 | File.Delete | Eliminar archivo |
| 516 | File.Exists | Verificar existencia |
| 517 | File.List | Listar directorio |
| 518 | File.Create | Crear archivo vacío |
| 519 | File.MakeDir | Crear directorio |
| 520 | File.RemoveDir | Eliminar directorio vacío |
| 768 | Process.List | Listar procesos |

### Patrones de bytecode comunes

**For loop:**
```
INIT → LOOP_START: COND → JUMP_IF_FALSE → BODY → INCREMENT → JUMP LOOP_START
```

**If/Else:**
```
COND → JUMP_IF_FALSE else → IF_BODY → JUMP end → ELSE_BODY → end
```

**Acceso a propiedad de array:**
```
LOAD_LOCAL array → LOAD_LOCAL idx → GET_ELEMENT → GET_PROPERTY propIdx
```
