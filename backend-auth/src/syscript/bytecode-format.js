// Syscript Bytecode Format (simplified for MVP)
// For now, we use JSON format for easy debugging

/**
 * Bytecode structure:
 * {
 *   version: "1.0",
 *   constants: [],           // String/number constants
 *   instructions: []         // Array of [opcode, ...operands]
 * }
 */

// Instruction opcodes
const OPCODES = {
  // Stack operations
  LOAD_CONST: 0x01,      // Push constant[operand] to stack
  LOAD_ARG: 0x02,        // Push args[operand] to stack
  STORE_LOCAL: 0x03,     // Pop value, store in locals[operand]
  LOAD_LOCAL: 0x04,      // Push locals[operand] to stack

  // Array/Object operations
  GET_LENGTH: 0x10,      // Get array length (pop array, push length)
  GET_ELEMENT: 0x11,     // Get element (pop index, pop array, push element)
  GET_PROPERTY: 0x12,    // Get property (operand=prop name index, pop object, push value)

  // Arithmetic operations
  ADD: 0x18,             // Pop 2, push a + b
  SUB: 0x19,             // Pop 2, push a - b
  MUL: 0x1A,             // Pop 2, push a * b
  DIV: 0x1B,             // Pop 2, push a / b
  MOD: 0x1C,             // Pop 2, push a % b
  NEG: 0x1D,             // Pop 1, push -a

  // Comparison
  EQ: 0x20,              // Equal (pop 2, push bool)
  NEQ: 0x21,             // Not equal (pop 2, push bool)
  LT: 0x22,              // Less than (pop 2, push bool)
  GT: 0x23,              // Greater than (pop 2, push bool)
  LTE: 0x24,             // Less than or equal (pop 2, push bool)
  GTE: 0x25,             // Greater than or equal (pop 2, push bool)

  // Logical operations
  NOT: 0x28,             // Pop 1, push !a
  AND: 0x29,             // Pop 2, push a && b
  OR: 0x2A,              // Pop 2, push a || b

  // Control flow
  JUMP_IF_FALSE: 0x30,   // Jump if false (pop condition)
  JUMP: 0x31,            // Unconditional jump

  // Native API calls
  CALL_NATIVE: 0x40,     // Call native function

  // Function control
  RETURN: 0x50           // Return from function
};

// Native API function IDs
const NATIVE_API = {
  'Console.Log': 0x0100,
  'Console.ChangeDir': 0x0101,
  'Console.GetWorkingDir': 0x0102,
  'Console.Clear': 0x0103,
  'Console.Exit': 0x0104,

  'File.Read': 0x0200,
  'File.Write': 0x0201,
  'File.Append': 0x0202,
  'File.Delete': 0x0203,
  'File.Exists': 0x0204,
  'File.List': 0x0205,
  'File.Create': 0x0206,
  'File.MakeDir': 0x0207,
  'File.RemoveDir': 0x0208,
  'File.Copy': 0x0209,

  'Process.List': 0x0300,
  'Process.Kill': 0x0301,

  'Disk.Usage': 0x0400,
};

module.exports = {
  OPCODES,
  NATIVE_API
};
