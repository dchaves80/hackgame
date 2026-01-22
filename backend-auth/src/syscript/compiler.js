// Syscript Compiler
// Compiles .syscript source code to bytecode

const { OPCODES, NATIVE_API } = require('./bytecode-format');

/**
 * Simple tokenizer for Syscript
 */
function tokenize(source) {
  const tokens = [];
  const keywords = ['void', 'string', 'int', 'float', 'bool', 'if', 'else', 'for', 'while', 'return', 'true', 'false', 'null'];
  const regex = /\/\/.*|\/\*[\s\S]*?\*\/|"[^"]*"|'[^']*'|[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+\.[0-9]+|[0-9]+|\.|;|\(|\)|\{|\}|\[|\]|==|!=|<=|>=|=|<|>|!|\+|-|\*|\/|,|&&|\|\|/g;

  let match;
  while ((match = regex.exec(source)) !== null) {
    const token = match[0];

    // Skip comments
    if (token.startsWith('//') || token.startsWith('/*')) {
      continue;
    }

    // String literals
    if (token.startsWith('"') || token.startsWith("'")) {
      tokens.push({ type: 'STRING', value: token.slice(1, -1) });
      continue;
    }

    // Float numbers (e.g., 3.14)
    if (/^[0-9]+\.[0-9]+$/.test(token)) {
      tokens.push({ type: 'FLOAT', value: parseFloat(token) });
      continue;
    }

    // Integer numbers
    if (/^[0-9]+$/.test(token)) {
      tokens.push({ type: 'NUMBER', value: parseInt(token) });
      continue;
    }

    // Boolean literals
    if (token === 'true' || token === 'false') {
      tokens.push({ type: 'BOOLEAN', value: token === 'true' });
      continue;
    }

    // Null literal
    if (token === 'null') {
      tokens.push({ type: 'NULL', value: null });
      continue;
    }

    // Keywords
    if (keywords.includes(token)) {
      tokens.push({ type: 'KEYWORD', value: token });
      continue;
    }

    // Identifiers
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      tokens.push({ type: 'IDENTIFIER', value: token });
      continue;
    }

    // Operators and punctuation
    tokens.push({ type: 'OPERATOR', value: token });
  }

  return tokens;
}

/**
 * Simple parser for Syscript
 * Parses tokens into AST
 */
function parse(tokens) {
  let current = 0;

  function peek() {
    return tokens[current];
  }

  function advance() {
    return tokens[current++];
  }

  function expect(type, value) {
    const token = advance();
    if (!token || token.type !== type || (value && token.value !== value)) {
      throw new Error(`Expected ${type} ${value || ''}, got ${token ? token.value : 'EOF'}`);
    }
    return token;
  }

  // Binary operator precedence (higher = binds tighter)
  const PRECEDENCE = {
    '||': 1,
    '&&': 2,
    '==': 3, '!=': 3,
    '<': 4, '>': 4, '<=': 4, '>=': 4,
    '+': 5, '-': 5,
    '*': 6, '/': 6, '%': 6
  };

  function parsePrimaryExpression() {
    const token = peek();

    // Parenthesized expression
    if (token?.value === '(') {
      advance(); // consume '('
      const expr = parseExpression();
      expect('OPERATOR', ')');
      return expr;
    }

    // String literal
    if (token.type === 'STRING') {
      advance();
      return { type: 'STRING_LITERAL', value: token.value };
    }

    // Number literal (int)
    if (token.type === 'NUMBER') {
      advance();
      return { type: 'NUMBER_LITERAL', value: token.value };
    }

    // Float literal
    if (token.type === 'FLOAT') {
      advance();
      return { type: 'FLOAT_LITERAL', value: token.value };
    }

    // Boolean literal
    if (token.type === 'BOOLEAN') {
      advance();
      return { type: 'BOOLEAN_LITERAL', value: token.value };
    }

    // Null literal
    if (token.type === 'NULL') {
      advance();
      return { type: 'NULL_LITERAL', value: null };
    }

    // Identifier or function call
    if (token.type === 'IDENTIFIER') {
      let identifier = advance();
      let result = { type: 'IDENTIFIER', value: identifier.value };

      // Handle chained access: procs[i].name, obj.prop, arr[0], etc.
      while (true) {
        // Property access or method call (e.g., obj.prop or Console.Log())
        if (peek()?.value === '.') {
          advance(); // consume '.'
          const property = expect('IDENTIFIER');

          // Check if it's a method call (has parentheses after)
          if (peek()?.value === '(') {
            advance(); // consume '('
            const args = [];

            while (peek()?.value !== ')') {
              args.push(parseExpression());
              if (peek()?.value === ',') {
                advance(); // consume ','
              }
            }

            expect('OPERATOR', ')');

            // If result is a simple identifier, use the combined method name
            if (result.type === 'IDENTIFIER') {
              result = {
                type: 'METHOD_CALL',
                method: `${result.value}.${property.value}`,
                arguments: args
              };
            } else {
              // Method call on expression result (not supported yet)
              throw new Error('Method calls on expressions not yet supported');
            }
          } else {
            // Property access
            result = {
              type: 'PROPERTY_ACCESS',
              object: result,
              property: property.value
            };
          }
          continue;
        }

        // Array access (e.g., arr[0])
        if (peek()?.value === '[') {
          advance(); // consume '['
          const index = parseExpression();
          expect('OPERATOR', ']');
          result = {
            type: 'ARRAY_ACCESS',
            array: result,
            index
          };
          continue;
        }

        // Function call (simple identifier followed by parentheses)
        if (result.type === 'IDENTIFIER' && peek()?.value === '(') {
          advance(); // consume '('
          const args = [];

          while (peek()?.value !== ')') {
            args.push(parseExpression());
            if (peek()?.value === ',') {
              advance(); // consume ','
            }
          }

          expect('OPERATOR', ')');

          result = {
            type: 'FUNCTION_CALL',
            name: result.value,
            arguments: args
          };
          continue;
        }

        // No more chaining
        break;
      }

      return result;
    }

    throw new Error(`Unexpected token: ${token?.value}`);
  }

  // Parse binary expression with precedence climbing
  function parseExpressionWithPrecedence(minPrecedence) {
    let left = parsePrimaryExpression();

    while (true) {
      const op = peek();
      if (!op || op.type !== 'OPERATOR') break;

      const precedence = PRECEDENCE[op.value];
      if (precedence === undefined || precedence < minPrecedence) break;

      advance(); // consume operator
      const right = parseExpressionWithPrecedence(precedence + 1);

      left = {
        type: 'BINARY_EXPRESSION',
        operator: op.value,
        left,
        right
      };
    }

    return left;
  }

  function parseExpression() {
    return parseExpressionWithPrecedence(1);
  }

  function parseStatement() {
    const token = peek();

    // Return statement
    if (token.type === 'KEYWORD' && token.value === 'return') {
      advance();
      expect('OPERATOR', ';');
      return { type: 'RETURN' };
    }

    // Variable declaration: int x; string name; string[] arr; etc.
    if (token.type === 'KEYWORD' && ['int', 'string', 'float', 'bool'].includes(token.value)) {
      let varType = advance().value;

      // Check for array type: string[], int[], etc.
      if (peek()?.value === '[') {
        advance(); // consume '['
        expect('OPERATOR', ']');
        varType = varType + '[]';
      }

      const varName = expect('IDENTIFIER').value;

      // Check for initialization: int x = 10;
      if (peek()?.value === '=') {
        advance(); // consume '='
        const initialValue = parseExpression();
        expect('OPERATOR', ';');
        return {
          type: 'VAR_DECLARATION',
          varType,
          varName,
          initialValue
        };
      }

      expect('OPERATOR', ';');
      return {
        type: 'VAR_DECLARATION',
        varType,
        varName,
        initialValue: null
      };
    }

    // Assignment: x = 10; or expression statement
    if (token.type === 'IDENTIFIER') {
      const name = advance().value;

      // Check if it's an assignment
      if (peek()?.value === '=') {
        advance(); // consume '='
        const value = parseExpression();
        expect('OPERATOR', ';');
        return {
          type: 'ASSIGNMENT',
          varName: name,
          value
        };
      }

      // Otherwise, rewind and parse as expression
      current--; // go back to identifier
    }

    // If statement (with optional else)
    if (token.type === 'KEYWORD' && token.value === 'if') {
      advance();
      expect('OPERATOR', '(');

      const condition = parseExpression();

      expect('OPERATOR', ')');
      expect('OPERATOR', '{');

      const body = [];
      while (peek()?.value !== '}') {
        body.push(parseStatement());
      }

      expect('OPERATOR', '}');

      // Check for else
      let elseBody = null;
      if (peek()?.type === 'KEYWORD' && peek()?.value === 'else') {
        advance(); // consume 'else'
        expect('OPERATOR', '{');

        elseBody = [];
        while (peek()?.value !== '}') {
          elseBody.push(parseStatement());
        }

        expect('OPERATOR', '}');
      }

      return {
        type: 'IF_STATEMENT',
        condition,
        body,
        elseBody
      };
    }

    // For loop: for (init; condition; increment) { body }
    if (token.type === 'KEYWORD' && token.value === 'for') {
      advance();
      expect('OPERATOR', '(');

      // Parse init (variable declaration or assignment)
      let init = null;
      if (peek()?.value !== ';') {
        const initToken = peek();
        if (initToken.type === 'KEYWORD' && ['int', 'string', 'float', 'bool'].includes(initToken.value)) {
          // Variable declaration
          const varType = advance().value;
          const varName = expect('IDENTIFIER').value;
          let initialValue = null;
          if (peek()?.value === '=') {
            advance();
            initialValue = parseExpression();
          }
          init = { type: 'VAR_DECLARATION', varType, varName, initialValue };
        } else {
          // Assignment
          const varName = expect('IDENTIFIER').value;
          expect('OPERATOR', '=');
          const value = parseExpression();
          init = { type: 'ASSIGNMENT', varName, value };
        }
      }
      expect('OPERATOR', ';');

      // Parse condition
      let condition = null;
      if (peek()?.value !== ';') {
        condition = parseExpression();
      }
      expect('OPERATOR', ';');

      // Parse increment
      let increment = null;
      if (peek()?.value !== ')') {
        const varName = expect('IDENTIFIER').value;
        expect('OPERATOR', '=');
        const value = parseExpression();
        increment = { type: 'ASSIGNMENT', varName, value };
      }
      expect('OPERATOR', ')');

      expect('OPERATOR', '{');
      const body = [];
      while (peek()?.value !== '}') {
        body.push(parseStatement());
      }
      expect('OPERATOR', '}');

      return {
        type: 'FOR_STATEMENT',
        init,
        condition,
        increment,
        body
      };
    }

    // While loop: while (condition) { body }
    if (token.type === 'KEYWORD' && token.value === 'while') {
      advance();
      expect('OPERATOR', '(');

      const condition = parseExpression();

      expect('OPERATOR', ')');
      expect('OPERATOR', '{');

      const body = [];
      while (peek()?.value !== '}') {
        body.push(parseStatement());
      }

      expect('OPERATOR', '}');

      return {
        type: 'WHILE_STATEMENT',
        condition,
        body
      };
    }

    // Expression statement (function/method call)
    const expr = parseExpression();
    expect('OPERATOR', ';');
    return { type: 'EXPRESSION_STATEMENT', expression: expr };
  }

  function parseFunction() {
    expect('KEYWORD', 'void');
    const name = expect('IDENTIFIER');
    expect('OPERATOR', '(');

    // Parse parameters
    const params = [];
    while (peek()?.value !== ')') {
      const paramType = advance(); // string, int, etc.
      if (peek()?.value === '[') {
        advance(); // consume '['
        expect('OPERATOR', ']');
      }
      const paramName = expect('IDENTIFIER');
      params.push({ type: paramType.value, name: paramName.value });

      if (peek()?.value === ',') {
        advance(); // consume ','
      }
    }

    expect('OPERATOR', ')');
    expect('OPERATOR', '{');

    // Parse function body
    const body = [];
    while (peek()?.value !== '}') {
      body.push(parseStatement());
    }

    expect('OPERATOR', '}');

    return {
      type: 'FUNCTION',
      name: name.value,
      parameters: params,
      body
    };
  }

  // Start parsing
  const ast = {
    type: 'PROGRAM',
    functions: []
  };

  while (current < tokens.length) {
    ast.functions.push(parseFunction());
  }

  return ast;
}

/**
 * Compile AST to bytecode
 */
function compile(ast) {
  const constants = [];
  const instructions = [];

  // Symbol table: { varName: { index, type } }
  const symbols = {};
  let localCount = 0;

  function addConstant(value) {
    let index = constants.indexOf(value);
    if (index === -1) {
      index = constants.length;
      constants.push(value);
    }
    return index;
  }

  // Get the type of an expression
  function getExprType(expr) {
    switch (expr.type) {
      case 'STRING_LITERAL': return 'string';
      case 'NUMBER_LITERAL': return 'int';
      case 'FLOAT_LITERAL': return 'float';
      case 'BOOLEAN_LITERAL': return 'bool';
      case 'NULL_LITERAL': return 'null';
      case 'IDENTIFIER':
        if (expr.value === 'args') return 'string[]';
        if (symbols[expr.value]) return symbols[expr.value].type;
        throw new Error(`Undefined variable: ${expr.value}`);
      case 'PROPERTY_ACCESS':
        if (expr.object === 'args' && expr.property === 'Length') return 'int';
        return 'unknown';
      case 'ARRAY_ACCESS':
        if (expr.array === 'args') return 'string';
        return 'unknown';
      case 'METHOD_CALL':
        // Console.GetWorkingDir returns string
        if (expr.method === 'Console.GetWorkingDir') return 'string';
        // File.Read returns string
        if (expr.method === 'File.Read') return 'string';
        // File.List returns array
        if (expr.method === 'File.List') return 'array';
        // File.Exists returns bool
        if (expr.method === 'File.Exists') return 'bool';
        // Process.List returns array
        if (expr.method === 'Process.List') return 'array';
        // Process.Kill returns object with { success, message }
        if (expr.method === 'Process.Kill') return 'array';
        // Disk.Usage returns object with { capacityMB, usedMB, availableMB, percent }
        if (expr.method === 'Disk.Usage') return 'array';
        // These return void: File.Write, File.Append, File.Delete, File.Create, Console.Log
        return 'void';
      case 'BINARY_EXPRESSION': {
        // Comparison and logical operators return bool
        if (['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(expr.operator)) {
          return 'bool';
        }
        // For + operator, check if it's string concatenation
        const leftType = getExprType(expr.left);
        const rightType = getExprType(expr.right);
        if (expr.operator === '+' && (leftType === 'string' || rightType === 'string')) {
          return 'string';
        }
        // Arithmetic operators return the type of operands
        if (leftType === 'float' || rightType === 'float') return 'float';
        return 'int';
      }
      default: return 'unknown';
    }
  }

  // Check if types are compatible for assignment
  function checkTypeCompatibility(declaredType, exprType) {
    if (declaredType === exprType) return true;
    // Allow int -> float conversion
    if (declaredType === 'float' && exprType === 'int') return true;
    // Allow 'array' for any array type (string[], int[], etc.)
    if (declaredType.endsWith('[]') && exprType === 'array') return true;
    // Allow null to be assigned to any reference type
    if (exprType === 'null') return true;
    return false;
  }

  function compileExpression(expr) {
    switch (expr.type) {
      case 'STRING_LITERAL':
        instructions.push([OPCODES.LOAD_CONST, addConstant(expr.value)]);
        break;

      case 'NUMBER_LITERAL':
        instructions.push([OPCODES.LOAD_CONST, addConstant(expr.value)]);
        break;

      case 'FLOAT_LITERAL':
        instructions.push([OPCODES.LOAD_CONST, addConstant(expr.value)]);
        break;

      case 'BOOLEAN_LITERAL':
        instructions.push([OPCODES.LOAD_CONST, addConstant(expr.value)]);
        break;

      case 'NULL_LITERAL':
        instructions.push([OPCODES.LOAD_CONST, addConstant(null)]);
        break;

      case 'IDENTIFIER':
        // Check for 'args' parameter
        if (expr.value === 'args') {
          instructions.push([OPCODES.LOAD_ARG, 0]);
          break;
        }
        // Check for local variable
        if (symbols[expr.value]) {
          instructions.push([OPCODES.LOAD_LOCAL, symbols[expr.value].index]);
          break;
        }
        throw new Error(`Undefined variable: ${expr.value}`);
        break;

      case 'PROPERTY_ACCESS': {
        // Compile the object expression first
        compileExpression(expr.object);

        // Special case: .Length on arrays
        if (expr.property === 'Length') {
          instructions.push([OPCODES.GET_LENGTH]);
        } else {
          // General property access
          instructions.push([OPCODES.GET_PROPERTY, addConstant(expr.property)]);
        }
        break;
      }

      case 'ARRAY_ACCESS':
        // Compile the array expression first
        compileExpression(expr.array);
        // Then compile the index
        compileExpression(expr.index);
        // Get the element
        instructions.push([OPCODES.GET_ELEMENT]);
        break;

      case 'METHOD_CALL':
        // Compile arguments first
        for (const arg of expr.arguments) {
          compileExpression(arg);
        }

        // Call native API
        const apiName = expr.method;
        if (NATIVE_API[apiName]) {
          instructions.push([OPCODES.CALL_NATIVE, NATIVE_API[apiName]]);
        } else {
          throw new Error(`Unknown native API: ${apiName}`);
        }
        break;

      case 'BINARY_EXPRESSION': {
        // Compile left and right operands
        compileExpression(expr.left);
        compileExpression(expr.right);

        // Emit operator instruction
        switch (expr.operator) {
          case '+': instructions.push([OPCODES.ADD]); break;
          case '-': instructions.push([OPCODES.SUB]); break;
          case '*': instructions.push([OPCODES.MUL]); break;
          case '/': instructions.push([OPCODES.DIV]); break;
          case '%': instructions.push([OPCODES.MOD]); break;
          case '==': instructions.push([OPCODES.EQ]); break;
          case '!=': instructions.push([OPCODES.NEQ]); break;
          case '<': instructions.push([OPCODES.LT]); break;
          case '>': instructions.push([OPCODES.GT]); break;
          case '<=': instructions.push([OPCODES.LTE]); break;
          case '>=': instructions.push([OPCODES.GTE]); break;
          case '&&': instructions.push([OPCODES.AND]); break;
          case '||': instructions.push([OPCODES.OR]); break;
          default:
            throw new Error(`Unknown operator: ${expr.operator}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown expression type: ${expr.type}`);
    }
  }

  function compileStatement(stmt) {
    switch (stmt.type) {
      case 'RETURN':
        instructions.push([OPCODES.RETURN]);
        break;

      case 'VAR_DECLARATION': {
        // Check if variable already declared
        if (symbols[stmt.varName]) {
          throw new Error(`Variable '${stmt.varName}' already declared`);
        }

        // Register variable in symbol table
        const varIndex = localCount++;
        symbols[stmt.varName] = { index: varIndex, type: stmt.varType };

        // If there's an initial value, compile it and store
        if (stmt.initialValue) {
          const valueType = getExprType(stmt.initialValue);
          if (!checkTypeCompatibility(stmt.varType, valueType)) {
            throw new Error(`Type error: cannot assign ${valueType} to ${stmt.varType} variable '${stmt.varName}'`);
          }
          compileExpression(stmt.initialValue);
          instructions.push([OPCODES.STORE_LOCAL, varIndex]);
        }
        break;
      }

      case 'ASSIGNMENT': {
        // Check if variable exists
        if (!symbols[stmt.varName]) {
          throw new Error(`Undefined variable: ${stmt.varName}`);
        }

        const varInfo = symbols[stmt.varName];
        const valueType = getExprType(stmt.value);

        // Type check
        if (!checkTypeCompatibility(varInfo.type, valueType)) {
          throw new Error(`Type error: cannot assign ${valueType} to ${varInfo.type} variable '${stmt.varName}'`);
        }

        // Compile expression and store
        compileExpression(stmt.value);
        instructions.push([OPCODES.STORE_LOCAL, varInfo.index]);
        break;
      }

      case 'IF_STATEMENT': {
        // Compile condition (now a full expression)
        compileExpression(stmt.condition);

        // JUMP_IF_FALSE to skip the if body (to else or end)
        const jumpToElseIndex = instructions.length;
        instructions.push([OPCODES.JUMP_IF_FALSE, 0]); // placeholder

        // Compile if body
        for (const bodyStmt of stmt.body) {
          compileStatement(bodyStmt);
        }

        if (stmt.elseBody) {
          // Jump over else body after if body completes
          const jumpToEndIndex = instructions.length;
          instructions.push([OPCODES.JUMP, 0]); // placeholder

          // Update jump-to-else target
          instructions[jumpToElseIndex][1] = instructions.length;

          // Compile else body
          for (const elseStmt of stmt.elseBody) {
            compileStatement(elseStmt);
          }

          // Update jump-to-end target
          instructions[jumpToEndIndex][1] = instructions.length;
        } else {
          // No else - just update jump target to after if body
          instructions[jumpToElseIndex][1] = instructions.length;
        }
        break;
      }

      case 'FOR_STATEMENT': {
        // for (init; condition; increment) { body }
        //
        // Bytecode structure:
        // 1. init
        // 2. LOOP_START: condition
        // 3. JUMP_IF_FALSE -> LOOP_END
        // 4. body
        // 5. increment
        // 6. JUMP -> LOOP_START
        // 7. LOOP_END:

        // 1. Compile init
        if (stmt.init) {
          compileStatement(stmt.init);
        }

        // 2. LOOP_START: Save position for condition
        const loopStart = instructions.length;

        // 3. Compile condition and jump if false
        if (stmt.condition) {
          compileExpression(stmt.condition);
          var jumpIfFalseIndex = instructions.length;
          instructions.push([OPCODES.JUMP_IF_FALSE, 0]); // placeholder
        }

        // 4. Compile body
        for (const bodyStmt of stmt.body) {
          compileStatement(bodyStmt);
        }

        // 5. Compile increment
        if (stmt.increment) {
          compileStatement(stmt.increment);
        }

        // 6. JUMP back to LOOP_START
        instructions.push([OPCODES.JUMP, loopStart]);

        // 7. LOOP_END: Update jump target
        if (stmt.condition) {
          instructions[jumpIfFalseIndex][1] = instructions.length;
        }
        break;
      }

      case 'WHILE_STATEMENT': {
        // while (condition) { body }
        //
        // Bytecode structure:
        // 1. LOOP_START: condition
        // 2. JUMP_IF_FALSE -> LOOP_END
        // 3. body
        // 4. JUMP -> LOOP_START
        // 5. LOOP_END:

        // 1. LOOP_START
        const loopStart = instructions.length;

        // 2. Compile condition and jump if false
        compileExpression(stmt.condition);
        const jumpIfFalseIndex = instructions.length;
        instructions.push([OPCODES.JUMP_IF_FALSE, 0]); // placeholder

        // 3. Compile body
        for (const bodyStmt of stmt.body) {
          compileStatement(bodyStmt);
        }

        // 4. JUMP back to LOOP_START
        instructions.push([OPCODES.JUMP, loopStart]);

        // 5. LOOP_END: Update jump target
        instructions[jumpIfFalseIndex][1] = instructions.length;
        break;
      }

      case 'EXPRESSION_STATEMENT':
        compileExpression(stmt.expression);
        break;

      default:
        throw new Error(`Unknown statement type: ${stmt.type}`);
    }
  }

  function compileFunction(func) {
    // Only compile Main function for now
    if (func.name !== 'Main') {
      throw new Error('Only Main function is supported');
    }

    for (const stmt of func.body) {
      compileStatement(stmt);
    }
  }

  // Compile all functions
  for (const func of ast.functions) {
    compileFunction(func);
  }

  return {
    version: '1.0',
    constants,
    instructions
  };
}

/**
 * Main compiler function
 */
function compileSyscript(source) {
  try {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const bytecode = compile(ast);
    return { success: true, bytecode, errors: [] };
  } catch (error) {
    return { success: false, bytecode: null, errors: [error.message] };
  }
}

module.exports = {
  compileSyscript,
  tokenize,
  parse,
  compile
};
