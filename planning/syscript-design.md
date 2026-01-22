# Syscript Language Design

## Overview
Syscript is a C#-style procedural scripting language for the hacker game. Scripts are compiled to Lua-style bytecode and executed by a virtual machine.

## File Extensions
- Source files: `.syscript`
- Compiled binaries: no extension (e.g., `/usr/bin/cd`)

## Language Syntax

### Basic Structure
```csharp
// Entry point - required
void Main(string[] args) {
    // Code here
}

// Custom functions
int Add(int a, int b) {
    return a + b;
}
```

### Types
- `int` - Integer numbers
- `float` - Floating point numbers
- `string` - Text strings
- `bool` - Boolean (true/false)
- Arrays: `int[]`, `string[]`, etc.

### Control Flow
```csharp
// If statement
if (condition) {
    // code
} else {
    // code
}

// While loop
while (condition) {
    // code
}

// For loop
for (int i = 0; i < 10; i++) {
    // code
}
```

### Operators
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&`, `||`, `!`
- Assignment: `=`, `+=`, `-=`, `*=`, `/=`

## Native APIs

### Console API
```csharp
Console.Log(string message)           // Print to terminal
Console.ChangeDir(string path)        // Change working directory
Console.GetWorkingDir()               // Get current directory
Console.Clear()                       // Clear terminal
Console.Exit(int code)                // Exit with code
```

### File API
```csharp
File.Read(string path)                // Read file content
File.Write(string path, string data)  // Write to file
File.Append(string path, string data) // Append to file
File.Delete(string path)              // Delete file
File.Exists(string path)              // Check if exists
File.List(string directory)           // List directory contents
File.Move(string from, string to)     // Move/rename
File.Copy(string from, string to)     // Copy file
File.MakeDir(string path)             // Create directory
```

### Device API (for hacking)
```csharp
Device.Exec(string mac, string cmd, string[] args)  // Execute on device
Device.GetLocal()                     // Get local PC MAC
Device.Scan(string target)            // Scan for devices
Device.Connect(string ip, int port)   // Connect to remote
```

## Bytecode Format

### Header
```
Magic: "SYSC" (4 bytes)
Version: 0x01 (1 byte)
Entry Point: offset to Main (4 bytes)
```

### Sections
1. **Constants Pool** - Strings, numbers, etc.
2. **Functions** - Function definitions with bytecode
3. **Debug Info** (optional) - Line numbers, variable names

### Instruction Set

#### Stack Operations
```
LOAD_CONST   index      // Push constant[index] to stack
LOAD_ARG     index      // Push args[index] to stack
LOAD_LOCAL   index      // Push local[index] to stack
STORE_LOCAL  index      // Pop stack to local[index]
POP                     // Pop and discard top of stack
DUP                     // Duplicate top of stack
```

#### Arithmetic
```
ADD, SUB, MUL, DIV, MOD  // Binary operations (pop 2, push result)
NEG                      // Unary negation (pop 1, push result)
```

#### Comparison
```
EQ, NE, LT, GT, LE, GE   // Compare (pop 2, push bool)
```

#### Logical
```
AND, OR, NOT             // Logical operations
```

#### Control Flow
```
JUMP         offset      // Unconditional jump
JUMP_IF      offset      // Jump if top is true
JUMP_IF_NOT  offset      // Jump if top is false
CALL         func_id     // Call function
RETURN                   // Return from function
```

#### Array Operations
```
NEW_ARRAY    size        // Create array
GET_ELEMENT              // array[index] (pop index, pop array, push element)
SET_ELEMENT              // array[index] = value (pop value, pop index, pop array)
GET_LENGTH               // Get array length (pop array, push length)
```

#### Native Calls
```
CALL_NATIVE  api_id      // Call native API function
```

### Native API IDs
```
// Console.*
0x0100: Console.Log
0x0101: Console.ChangeDir
0x0102: Console.GetWorkingDir
0x0103: Console.Clear
0x0104: Console.Exit

// File.*
0x0200: File.Read
0x0201: File.Write
0x0202: File.Append
0x0203: File.Delete
0x0204: File.Exists
0x0205: File.List
0x0206: File.Move
0x0207: File.Copy
0x0208: File.MakeDir

// Device.*
0x0300: Device.Exec
0x0301: Device.GetLocal
0x0302: Device.Scan
0x0303: Device.Connect
```

## Example: cd.syscript

### Source Code
```csharp
void Main(string[] args) {
    if (args.Length == 0) {
        Console.Log("cd: missing operand");
        return;
    }
    Console.ChangeDir(args[0]);
}
```

### Bytecode (pseudo-assembly)
```
Constants:
  0: "cd: missing operand"

Main:
  LOAD_ARG      0           // args
  GET_LENGTH                // args.Length
  LOAD_CONST_I  0           // 0
  EQ                        // args.Length == 0
  JUMP_IF_NOT   error       // if false, skip to end
  LOAD_CONST    0           // "cd: missing operand"
  CALL_NATIVE   0x0100      // Console.Log
  RETURN
error:
  LOAD_ARG      0           // args
  LOAD_CONST_I  0           // 0
  GET_ELEMENT               // args[0]
  CALL_NATIVE   0x0101      // Console.ChangeDir
  RETURN
```

## Compilation Process

1. **Lexer**: `.syscript` → tokens
2. **Parser**: tokens → AST (Abstract Syntax Tree)
3. **Semantic Analysis**: Type checking, scope resolution
4. **Code Generation**: AST → bytecode
5. **Serialization**: bytecode → binary file

## Execution Process

1. Terminal receives command (e.g., `cd /home`)
2. Search PATH: `./ → /bin → /usr/bin`
3. Find binary `/usr/bin/cd`
4. Load bytecode from binary
5. Verify magic number and version
6. Create VM instance with working directory context
7. Execute bytecode starting at Main
8. Pass arguments: `["/home"]`
9. VM executes instructions, calling native APIs as needed
10. Return output and new working directory to terminal

## Filesystem Structure

### System Files
```
/usr/src/
├── cd.syscript
├── ls.syscript
├── cat.syscript
├── pwd.syscript
├── mkdir.syscript
└── rm.syscript

/usr/bin/
├── cd              (compiled)
├── ls              (compiled)
├── cat             (compiled)
├── pwd             (compiled)
├── mkdir           (compiled)
├── rm              (compiled)
└── build           (compiler - also written in Syscript!)

/home/user/
└── hello.syscript  (demo for user)
```

## Build Command

The `build` command compiles `.syscript` files to binaries.

### Usage
```bash
build input.syscript          # Creates 'input' in current dir
build input.syscript output   # Creates 'output'
build -o /usr/bin/mytool input.syscript  # Specify output path
```

### Build Command Implementation
The `build` binary itself contains the Syscript compiler (parser + code generator).

## Implementation Plan

### Phase 1: Core Infrastructure
1. Define bytecode format
2. Implement bytecode serializer/deserializer
3. Create VM interpreter with native API bindings
4. Test with hand-written bytecode

### Phase 2: Compiler
1. Lexer (tokenization)
2. Parser (AST generation)
3. Semantic analyzer
4. Code generator (AST → bytecode)
5. Build command

### Phase 3: Terminal Integration
1. TerminalContent.tsx component
2. Terminal session management
3. /api/terminal/execute endpoint
4. PATH search logic
5. Binary execution

### Phase 4: Demo Content
1. Write .syscript files for basic commands
2. Pre-compile to binaries
3. Seed filesystem with sources and binaries
4. Create tutorial/documentation

## Technical Decisions

### Why Lua-style bytecode?
- Compact binary format
- Well-understood VM architecture
- Easy to serialize/deserialize
- Good balance of simplicity and power

### Why not interpret source directly?
- Compilation teaches hacking concepts (reverse engineering)
- Forces players to understand compilation
- Bytecode can be "decompiled" as a gameplay mechanic
- More realistic simulation

### Why procedural C# syntax?
- Familiar to many developers
- Clear and readable
- Matches game's hacker/technical aesthetic
- Avoids complexity of OOP for this use case
