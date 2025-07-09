class Environment {
    constructor(parent = null) {
        this.parent = parent;
        this.bindings = {};
    }

    extend() {
        return new Environment(this);
    }

    define(name, value) {
        this.bindings[name] = value;
    }

    lookup(name) {
        if (name in this.bindings) {
            return this.bindings[name];
        } else if (this.parent !== null) {
            return this.parent.lookup(name);
        } else {
            throw new Error(`Undefined symbol: ${name}`);
        }
    }
}

// Tipos básicos
class Natural {
    constructor(value) {
        if (value < 0) throw new Error("Natural numbers must be non-negative");
        this.value = value;
    }

    toString() {
        if (this.value === 0) return "Zero";
        return `Succ[${new Natural(this.value - 1).toString()}]`;
    }

    equals(other) {
        return other instanceof Natural && this.value === other.value;
    }

    evaluate(env) {
        return this;
    }

    reduce(env) {
        return this;
    }
}

class Boolean {
    constructor(value) {
        this.value = value;
    }

    toString() {
        return this.value ? "True" : "False";
    }

    equals(other) {
        return other instanceof Boolean && this.value === other.value;
    }

    evaluate(env) {
        return this;
    }

    reduce(env) {
        return this;
    }
}

class Symbol {
    constructor(name) {
        this.name = name;
    }

    toString() {
        return this.name;
    }

    evaluate(env) {
        return env.lookup(this.name);
    }

    reduce(env) {
        return env.lookup(this.name);
    }
}

// Funciones auxiliares
function parsePeanoNumber(input) {
    if (input.startsWith("'")) {
        const num = parseInt(input.slice(1));
        if (isNaN(num)) throw new Error(`Invalid Peano number: ${input}`);
        return new Natural(num);
    }
    return null;
}

function parseExpression(input, env) {
    input = input.trim();

    // Números Peano
    const peano = parsePeanoNumber(input);
    if (peano !== null) return peano;

    // Símbolos
    if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(input)) {
        return new Symbol(input);
    }

    // Aplicaciones
    if (input.endsWith("]")) {
        const openBracket = input.indexOf("[");
        if (openBracket === -1) throw new Error("Invalid application syntax");

        const funcName = input.substring(0, openBracket);
        const argsStr = input.substring(openBracket + 1, input.length - 1);

        const func = parseExpression(funcName, env);
        const args = splitArgs(argsStr).map(arg => parseExpression(arg, env));

        return new Application(func, args);
    }

    throw new Error(`Cannot parse expression: ${input}`);
}

function splitArgs(argsStr) {
    if (!argsStr.trim()) return [];

    const args = [];
    let current = "";
    let depth = 0;

    for (const char of argsStr) {
        if (char === "," && depth === 0) {
            args.push(current.trim());
            current = "";
        } else {
            current += char;
            if (char === "[") depth++;
            if (char === "]") depth--;
        }
    }

    if (current.trim()) {
        args.push(current.trim());
    }

    return args;
}

// Formas especiales
class EvaluateForm {
    static evaluate(expr, env) {
        return expr.evaluate(env);
    }

    static toString() {
        return "Evaluate";
    }
}

class ReduceForm {
    static reduce(expr, env) {
        return expr.reduce(env);
    }

    static toString() {
        return "Reduce";
    }
}

class Bind {
    constructor(params, body) {
        this.params = params;
        this.body = body;
    }

    toString() {
        return `Bind[${this.params.join(", ")}, ${this.body}]`;
    }

    evaluate(env) {
        return this;
    }

    reduce(env) {
        return this;
    }
}

class Recurse {
    constructor(variable, recursiveCase, baseCase) {
        this.variable = variable;
        this.recursiveCase = recursiveCase;
        this.baseCase = baseCase;
    }

    evaluateRecursive(n, env) {
        if (n.value === 0) {
            return this.baseCase.evaluate(env);
        }

        const newEnv = env.extend();
        newEnv.define(this.variable, new Natural(n.value - 1));

        const prevStep = this.evaluateRecursive(new Natural(n.value - 1), env);
        newEnv.define("Self", prevStep);

        return this.recursiveCase.evaluate(newEnv);
    }

    toString() {
        return `Recurse[${this.variable}, ${this.recursiveCase}, ${this.baseCase}]`;
    }

    evaluate(env) {
        return this;
    }

    reduce(env) {
        return this;
    }
}

class Application {
    constructor(func, args) {
        this.func = func;
        this.args = args;
    }

    evaluate(env) {
        const evaluatedFunc = this.func.evaluate(env);
        const evaluatedArgs = this.args.map(arg => arg.evaluate(env));

        // Formas especiales
        if (evaluatedFunc === EvaluateForm) {
            if (evaluatedArgs.length !== 1) throw new Error("Evaluate takes exactly one argument");
            return evaluatedArgs[0].evaluate(env);
        }

        if (evaluatedFunc === ReduceForm) {
            if (evaluatedArgs.length !== 1) throw new Error("Reduce takes exactly one argument");
            return evaluatedArgs[0].reduce(env);
        }

        // Bind (lambda)
        if (evaluatedFunc instanceof Bind) {
            if (evaluatedArgs.length !== evaluatedFunc.params.length) {
                throw new Error(`Expected ${evaluatedFunc.params.length} arguments, got ${evaluatedArgs.length}`);
            }

            const newEnv = env.extend();
            for (let i = 0; i < evaluatedFunc.params.length; i++) {
                newEnv.define(evaluatedFunc.params[i], evaluatedArgs[i]);
            }

            return evaluatedFunc.body.evaluate(newEnv);
        }

        // Recurse
        if (evaluatedFunc instanceof Recurse) {
            if (evaluatedArgs.length !== 1) throw new Error("Recurse takes exactly one argument");
            if (!(evaluatedArgs[0] instanceof Natural)) throw new Error("Recursion argument must be a natural number");

            return evaluatedFunc.evaluateRecursive(evaluatedArgs[0], env);
        }

        // Aplicación normal
        if (typeof evaluatedFunc === 'function') {
            return evaluatedFunc(...evaluatedArgs);
        }

        return new Application(evaluatedFunc, evaluatedArgs);
    }

    reduce(env) {
        const reducedFunc = this.func.reduce(env);
        const reducedArgs = this.args.map(arg => arg.reduce(env));

        if (typeof reducedFunc === 'function') {
            return reducedFunc(...reducedArgs);
        }

        return new Application(reducedFunc, reducedArgs);
    }

    toString() {
        const argsStr = this.args.map(arg => arg.toString()).join(", ");
        return `${this.func}[${argsStr}]`;
    }
}

// Operadores lógicos
function And(a, b) {
    if (a instanceof Boolean && b instanceof Boolean) {
        return new Boolean(a.value && b.value);
    }
    return new Application(And, [a, b]);
}

function Or(a, b) {
    if (a instanceof Boolean && b instanceof Boolean) {
        return new Boolean(a.value || b.value);
    }
    return new Application(Or, [a, b]);
}

function Not(a) {
    if (a instanceof Boolean) {
        return new Boolean(!a.value);
    }
    return new Application(Not, [a]);
}

function Equal(a, b) {
    if (a.equals && b.equals) {
        return new Boolean(a.equals(b));
    }
    return new Application(Equal, [a, b]);
}

// Operaciones aritméticas
function Succ(n) {
    if (n instanceof Natural) {
        return new Natural(n.value + 1);
    }
    return new Application(Succ, [n]);
}

function Add(a, b) {
    if (a instanceof Natural && b instanceof Natural) {
        return new Natural(a.value + b.value);
    }
    return new Application(Add, [a, b]);
}

function LessThan(a, b) {
    if (a instanceof Natural && b instanceof Natural) {
        return new Boolean(a.value < b.value);
    }
    return new Application(LessThan, [a, b]);
}

// Configurar entorno global
function setupGlobalEnvironment() {
    const env = new Environment();

    // Definir Zero
    env.define("Zero", new Natural(0));

    // Definir valores booleanos
    env.define("True", new Boolean(true));
    env.define("False", new Boolean(false));

    // Definir operadores lógicos
    env.define("And", And);
    env.define("Or", Or);
    env.define("Not", Not);
    env.define("Equal", Equal);

    // Definir operaciones aritméticas
    env.define("Succ", Succ);
    env.define("Add", Add);
    env.define("LessThan", LessThan);

    // Definir formas especiales
    env.define("Evaluate", EvaluateForm);
    env.define("Reduce", ReduceForm);

    // Definir Bind y Recurse como funciones especiales
    env.define("Bind", function(...args) {
        if (args.length < 2) throw new Error("Bind needs at least 2 arguments");
        const params = args.slice(0, -1).map(arg => arg.name || arg.toString());
        const body = args[args.length - 1];
        return new Bind(params, body);
    });

    env.define("Recurse", function(variable, recursiveCase, baseCase) {
        return new Recurse(variable, recursiveCase, baseCase);
    });

    return env;
}

// Exportar para uso en repl.js
const globalEnv = setupGlobalEnvironment();
export { parseExpression, globalEnv };