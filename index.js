function formatPos({ fileName, line }) {
	return `${fileName}:${line}:`
}

class LuaError extends Error {
	constructor(position, message) {
		super(`${formatPos(position)} ${message}`)
	}
}

class LuaCFormatError extends Error {
	constructor(message) {
		super(message)
	}
}

const errors = {
	arithmetic: (position, type) => {
		throw new LuaError(position, `attempt to perform arithmetic on a ${type} value`)
	},
	concatenate: (position, type) => {
		throw new LuaError(position, `attempt to concatenate a ${type} value`)
	},
	compare: (position, leftType, rightType) => {
		if (leftType === rightType) {
			throw new LuaError(position, `attempt to compare two ${leftType} values`)
		}
		throw new LuaError(position, `attempt to compare ${leftType} with ${rightType}`)
	},
	length: (position, type) => {
		throw new LuaError(position, `attempt to get length of a ${type} value`)
	},
	forLimit: (position) => {
		throw new LuaError(position, `'for' limit must be a number`)
	},
	forInit: (position) => {
		throw new LuaError(position, `'for' initial value must be a number`)
	},
	forStep: (position) => {
		throw new LuaError(position, `'for' step must be a number`)
	},
	call: (position, type) => {
		throw new LuaError(position, `attempt to call a ${type} value`)
	},
	badArgType: (position, index, funcName, type, expected) => {
		throw new LuaError(position, `bad argument #${index} to '${funcName}' (${expected} expected, got ${type})`)
	}
}

function compHandler(context, value1, value2, metaMethodName) {
	if (value1.type !== value2.type) { return undefined }

	const metaMethod1 = getMeta(context, value1, metaMethodName)
	const metaMethod2 = getMeta(context, value2, metaMethodName)

	if (metaMethod1 === metaMethod2 || unwrap(metaMethod1.eq(context, metaMethod2))) {
		return metaMethod1
	}
	
	return undefined
}

class LVBase {
	constructor(type) {
		this.type = type
		this.metatable = null

		// playing pretend :3
		this.address = Math.floor(Math.random() * 0xFFFFFFF)
	}

	overrideable(context, operation, metaMethodName, notFoundOperation, ...metaArgs) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		const metaMethod = getMeta(context, this, metaMethodName)
		if (metaMethod && metaMethod.truthy(context)) {
			return call(context, metaMethod, this, ...metaArgs)
		}

		return notFoundOperation()
	}
	overrideableTwoSides(context, operation, metaMethodName, notFoundOperation, other) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		const metaMethod = getMeta(context, this, metaMethodName)
		if (metaMethod && metaMethod.truthy(context)) {
			return call(context, metaMethod, this, other)
		}
		else {
			const otherMeta = getMeta(context, other, metaMethodName)
			if (otherMeta && otherMeta.truthy(context)) {
				return call(context, otherMeta, this, other)
			}
		}

		return notFoundOperation()
	}

	add(context, other) {
		return this.overrideable(context, () => undefined, "__add", () => errors.arithmetic(context.position, this.type), other)
	}
	sub(context, other) {
		return this.overrideable(context, () => undefined, "__sub", () => errors.arithmetic(context.position, this.type), other)
	}
	mul(context, other) {
		return this.overrideable(context, () => undefined, "__mul", () => errors.arithmetic(context.position, this.type), other)
	}
	div(context, other) {
		return this.overrideable(context, () => undefined, "__div", () => errors.arithmetic(context.position, this.type), other)
	}
	mod(context, other) {
		return this.overrideable(context, () => undefined, "__mod", () => errors.arithmetic(context.position, this.type), other)
	}
	pow(context, other) {
		return this.overrideable(context, () => undefined, "__pow", () => errors.arithmetic(context.position, this.type), other)
	}

	concat(context, other) {
		return this.overrideableTwoSides(context, () => undefined, "__concat", () => errors.concatenate(context.position, this.type), other)
	}

	eq(context, other) {
		if (this.type !== other.type) {
			return new LVBoolean(false)
		}
		if (this === other) {
			return new LVBoolean(true)
		}

		return this.overrideable(context, () => undefined, "__eq", () => new LVBoolean(false), other)
	}
	lt(context, other) {
		const metaMethod = compHandler(context, this, other, "__lt")
		if (metaMethod && metaMethod.truthy(context)) {
			return call(context, metaMethod, this, other)
		}

		errors.compare(context.position, this.type, other.type)
	}
	le(context, other) {
		const metaMethod = compHandler(context, this, other, "__le")
		if (metaMethod && metaMethod.truthy(context)) {
			return call(context, metaMethod, this, other)
		}
		else {
			const otherMeta = compHandler(context, this, other, "__lt")
			if (otherMeta && otherMeta.truthy(context)) {
				return call(context, otherMeta, other, this).not(context)
			}
		}

		errors.compare(context.position, this.type, other.type)
	}

	unm(context) {
		return this.overrideable(context, () => undefined, "__unm", () => errors.arithmetic(context.position, this.type), other)
	}
	not(context) { return new LVBoolean(!this.truthy()) }
	len(context) {
		return this.overrideable(context, () => undefined, "__len", () => errors.length(context.position, this.type))
	}

	asNumber(context) { return new LVNil() }
	asString(context) { return new LVNil() }

	print(context) { return `${this.type}: 0x${this.address.toString(16).padStart(7, "0")}` }

	truthy(context) { return false }
}

class LVNumber extends LVBase {
	constructor(num) {
		super("number")

		this.value = num
	}

	add(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.asNumber(context)
			if (otherVal instanceof LVNil) {
				return undefined
			}

			otherVal = otherVal.value

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value + otherVal)
			}

			return undefined
		}, "__add", () => {
			errors.arithmetic(context.position, other.type)
		}, other)
	}

	sub(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.asNumber(context)
			if (otherVal instanceof LVNil) {
				return undefined
			}

			otherVal = otherVal.value

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value - otherVal)
			}

			return undefined
		}, "__sub", () => {
			errors.arithmetic(context.position, other.type)
		}, other)
	}

	mul(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.asNumber(context)
			if (otherVal instanceof LVNil) {
				return undefined
			}

			otherVal = otherVal.value

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value * otherVal)
			}

			return undefined
		}, "__mul", () => {
			errors.arithmetic(context.position, other.type)
		}, other)
	}

	div(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.asNumber(context)
			if (otherVal instanceof LVNil) {
				return undefined
			}

			otherVal = otherVal.value

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				if (otherVal === 0) {
					return new LVNumber(Infinity)
				}
				return new LVNumber(this.value / otherVal)
			}

			return undefined
		}, "__div", () => {
			errors.arithmetic(context.position, other.type)
		}, other)
	}

	mod(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.asNumber(context)
			if (otherVal instanceof LVNil) {
				return undefined
			}

			otherVal = otherVal.value

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value % otherVal)
			}

			return undefined
		}, "__mod", () => {
			errors.arithmetic(context.position, other.type)
		}, other)
	}

	pow(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.asNumber(context)
			if (otherVal instanceof LVNil) {
				return undefined
			}

			otherVal = otherVal.value

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value ** otherVal)
			}

			return undefined
		}, "__pow", () => {
			errors.arithmetic(context.position, other.type)
		}, other)
	}

	concat(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.value
			if (other.type === "number") {
				otherVal = String(otherVal)
			}

			if (typeof otherVal === "string") {
				return new LVString(String(this.value) + otherVal)
			}

			return undefined
		}, "__concat", () => {
			errors.concatenate(context.position, other.type)
		}, other)
	}

	eq(context, other) {
		const equal = new LVBoolean(this.type === other.type && this.value === other.value)
		if (equal) {
			return equal
		}
		else {
			return super.eq(context, other)
		}
	}

	lt(context, other) {
		return this.overrideable(context, () => {
			if (this.type === other.type) {
				return new LVBoolean(this.value < other.value)
			}
			
			return undefined
		}, "__lt", () => {
			errors.compare(context.position, this.type, other.type)
		}, other)
	}
	
	le(context, other) {
		return this.overrideable(context, () => {
			if (this.type === other.type) {
				return new LVBoolean(this.value <= other.value)
			}
			
			return undefined
		}, "__le", () => {
			errors.compare(context.position, this.type, other.type)
		}, other)
	}

	unm(context) {
		return new LVNumber(-this.value)
	}

	asNumber(context) {
		return new LVNumber(this.value)
	}
	asString(context) {
		return new LVString(String(this.value))
	}

	print(context) {
		return String(this.value)
	}

	truthy(context) {
		return true
	}
}

class LVString extends LVBase {
	constructor(bytes) {
		super("string")

		if (typeof bytes === "string") {
			bytes = new TextEncoder().encode(bytes)
		}

		if (!(bytes instanceof Uint8Array)) {
			throw new LuaCFormatError("invalid string literal; could not convert to bytestring")
		}

		this.value = bytes
	}

	concat(context, other) {
		return this.overrideable(context, () => {
			let otherVal = other.value
			if (other.type === "number") {
				otherVal = String(otherVal)
			}

			if (typeof otherVal === "string") {
				return new LVString(this.value + otherVal)
			}

			return undefined
		}, "__concat", () => {
			errors.concatenate(context.position, other.type)
		}, other)
	}

	eq(context, other) {
		return new LVBoolean(this.type === other.type && this.value === other.value)
	}

	lt(context, other) {
		return this.overrideable(context, () => {
			if (this.type !== other.type) {
				return undefined
			}

			const left = this.value
			const right = other.value

			const len = Math.min(left.length, right.length)
			
			for (let i = 0; i < len; i ++) {
				if (left[i] < right[i]) {
					return new LVBoolean(true)
				}
				if (left[i] > right[i]) {
					return new LVBoolean(false)
				}
			}
			
			return new LVBoolean(left.length < right.length)
		}, "__lt", () => {
			errors.compare(context.position, this.type, other.type)
		}, other)
	}
	
	le(context, other) {
		return this.overrideable(context, () => {
			if (this.type === other.type && this.value === other.value) {
				return new LVBoolean(true)
			}

			if (this.type !== other.type) {
				return undefined
			}
			
			const left = this.value
			const right = other.value

			const len = Math.min(left.length, right.length)
			
			for (let i = 0; i < len; i ++) {
				if (left[i] < right[i]) {
					return new LVBoolean(true)
				}
				if (left[i] > right[i]) {
					return new LVBoolean(false)
				}
			}
			
			return new LVBoolean(left.length < right.length)
		}, "__le", () => {
			errors.compare(context.position, this.type, other.type)
		}, other)
	}

	len(context) {
		return new LVNumber(this.value.length)
	}

	asNumber(context) {
		const str = new TextDecoder("utf-8").decode(this.value)

		if (isNaN(Number(str))) {
			return new LVNil()
		}

		return new LVNumber(Number(str))
	}
	asString(context) {
		return new LVString(this.value)
	}

	print(context) {
		return new TextDecoder("utf-8").decode(this.value)
	}

	truthy(context) {
		return true
	}
}

class LVBoolean extends LVBase {
	constructor(bool) {
		super("boolean")

		this.value = bool
	}

	eq(context, other) {
		return new LVBoolean(this.type === other.type && this.value === other.value)
	}

	print(context) {
		return String(this.value)
	}

	truthy(context) {
		return this.value
	}
}

class LVNil extends LVBase {
	constructor() {
		super("nil")

		this.value = null
	}

	eq(context, other) {
		return new LVBoolean(this.type === other.type)
	}

	print(context) {
		return "nil"
	}

	truthy(context) {
		return false
	}
}

class LVTable extends LVBase {
	constructor() {
		super("table")

		this.array = []
		this.hash = Object.create(null)
		this.keyOrder = []
	}

	keys() {
		return this.keyOrder.slice()
	}

	rawGet(context, key) {
		key = unwrap(key)

		if (typeof key === "number" && key >= 1 && Number.isInteger(key)) {
			return this.array[key] ?? new LVNil()
		}
	
		return this.hash[key] ?? new LVNil()
	}

	rawSet(context, key, value) {
		key = unwrap(key)
	
		if (typeof key === "number" && key >= 1 && Number.isInteger(key)) {
			if (!(key in this.array)) {
				this.keyOrder.push(key)
			}
			this.array[key] = value
		} else {
			if (!(key in this.hash)) {
				this.keyOrder.push(key)
			}
			this.hash[key] = value
		}
	}

	len(context) {
		let i = 1
		while (this.array[i] !== undefined) {
			i ++
		}

		return new LVNumber(i - 1)
	}

	truthy(context) {
		return true
	}
}

class LVTuple {
    constructor(values) {
        this.values = values
    }
}

class LVFunction extends LVBase {
	constructor(func) {
		super("function")

		this.value = func
	}

	truthy(context) {
		return true
	}
}

class LVClosure extends LVBase {
	constructor(proto) {
		super("function")

		this.proto = proto
		this.upvalues = new Array(proto.upValueCount)
	}

	truthy(context) {
		return true
	}
}

class LVCoroutine extends LVBase {
	constructor(closure, args) {
		super("thread")

		this.closure = closure
		this.status = "suspended"

		this.args = args ?? []

		this.pc = 0
		this.top = 0
		this.regs = Array.from({ length: closure.proto.maxStackSize }, () => new LVNil())
		this.openUpValues = []

		for (let i = 0; i < closure.proto.paramCount; i ++) {
			this.regs[i] = args[i] ?? new LVNil()
		}
	}
}

class LuaYield {
	constructor(values) {
		this.values = values
	}
}

class LVUpValue {
    constructor(parentRegs, index) {
        this.isOpen = true

        this.parentRegs = parentRegs
        this.index = index
        
		this.value = null
    }

    get() {
        return this.isOpen ? this.parentRegs[this.index] : this.value
    }

    set(value) {
        if (this.isOpen) {
            this.parentRegs[this.index] = value
        } else {
            this.value = value
        }
    }

    close() {
        if (this.isOpen) {
            this.value = this.parentRegs[this.index]
            
			this.parentRegs = null
            this.index = null
            
			this.isOpen = false
        }
    }
}

function wrap(context, value) {
	if (value instanceof LVBase) {
		return value
	}

	switch (typeof value) {
		case "number": return new LVNumber(value)
		case "string": return new LVString(value)
		case "boolean": return new LVBoolean(value)
		case "function": return new LVFunction(value)
		case "object":
			if (value === null) {
				return new LVNil()
			}
			
			const tbl = new LVTable()

			if (Array.isArray(value)) {
				for (let i = 0; i < value.length; i ++) {
					const item = value[i]

					tbl.rawSet(context, wrap(context, i + 1), wrap(context, item))
				}
			}
			else {
				for (const key in value) {
					const val = value[key]

					tbl.rawSet(context, wrap(context, key), wrap(context, val))
				}
			}
		default:
			return new LVNil()
	}
}

function unwrap(value) {
	if (value instanceof LVTuple) {
		return value.values
	}

	if (value instanceof LVString) {
		return new TextDecoder("utf-8").decode(value.value)
	}

	return value instanceof LVBase ? value.value : value
}

function getMeta(context, obj, name) {
	if (!obj.metatable) {
		return undefined
	}

	return obj.metatable.rawGet(context, name)
}

function call(context, value, ...args) {
	if (typeof value === "function") {
		return value(context, ...args)
	}
	else if (value instanceof LVFunction) {
		return value.value(context, ...args)
	}
	else if (value instanceof LVClosure) {
		return context.vm.runCoroutine(new LVCoroutine(value, ...args))
	}
	else if (value instanceof LVCoroutine) {
		return context.vm.runCoroutine(value)
	}
	else {
		if (value instanceof LVBase) {
			const metaMethod = getMeta(context, value, "__call")
			if (metaMethod && metaMethod.truthy()) {
				return call(context, metaMethod, value, ...args)
			}
		}

		errors.call(context.position, value?.type ?? typeof value)
	}
}

const LUA_SIGNATURE = [
	0x1B,
	0x4C,
	0x75,
	0x61
]

const LUA_OPCODES = {
	[0x51]: [
		"MOVE",
		"LOADK", "LOADBOOL", "LOADNIL",
		"GETUPVAL", "GETGLOBAL", "GETTABLE",
		"SETGLOBAL", "SETUPVAL", "SETTABLE", "NEWTABLE",
		"SELF",
		"ADD", "SUB", "MUL", "DIV", "MOD", "POW",
		"UNM", "NOT", "LEN",
		"CONCAT",
		"JMP",
		"EQ", "LT", "LE",
		"TEST", "TESTSET",
		"CALL", "TAILCALL", "RETURN",
		"FORLOOP", "FORPREP", "TFORLOOP",
		"SETLIST",
		"CLOSE",
		"CLOSURE",
		"VARARG"
	]
}

class LuaVM {
	constructor(data) {
		this.pos = 0
		this.data = data

		const sig = this.readBytes(LUA_SIGNATURE.length)

		for (let i = 0; i < sig.length; i ++) {
			if (sig[i] !== LUA_SIGNATURE[i]) {
				throw new LuaCFormatError("invalid luac file, incorrect signature")
			}
		}

		this.version = this.readByte()

		if (this.version !== 0x51) {
			throw new LuaCFormatError("only lua 5.1 is supported for now")
		}

		this.format = this.readByte()

		if (this.format !== 0) {
			throw new LuaCFormatError("invalid luac file, format non-zero")
		}

		const endianness = this.readByte()
		if (!([0, 1].includes(endianness))) {
			throw new LuaCFormatError("invalid luac file, neither big nor small endian")
		}

		this.isLittleEndian = endianness === 1

		this.intSize = this.readByte()

		this.sizeTSize = this.readByte()

		this.instSize = this.readByte()

		this.luaNumSize = this.readByte()
		
		const luaNumInt = this.readByte()
		if (!([0, 1].includes(luaNumInt))) {
			throw new LuaCFormatError("invalid luac file, lua number neither integral nor real")
		}

		this.luaNumIsInt = luaNumInt

		this.globals = new LVTable()

		const mathLib = new LVTable()

		mathLib.rawSet(null, "abs", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "abs", value.type, "number")
			}

			return wrap(context, Math.abs(value.value))
		}))

		mathLib.rawSet(null, "asin", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "asin", value.type, "number")
			}

			return wrap(context, Math.asin(value.value))
		}))
		mathLib.rawSet(null, "acos", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "acos", value.type, "number")
			}

			return wrap(context, Math.acos(value.value))
		}))
		mathLib.rawSet(null, "atan", new LVFunction((context, y, x) => {
			if (y.type !== "number") {
				errors.badArgType(context.position, 1, "atan", y.type, "number")
			}

			if (x === undefined) {
				return wrap(context, Math.atan(y.value))
			}

			if (x.type !== "number") {
				errors.badArgType(context.position, 2, "atan", x.type, "number")
			}

			return wrap(context, Math.atan2(y.value, x.value))
		}))

		mathLib.rawSet(null, "floor", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "floor", value.type, "number")
			}

			return wrap(context, Math.floor(value.value))
		}))
		mathLib.rawSet(null, "ceil", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "ceil", value.type, "number")
			}

			return wrap(context, Math.ceil(value.value))
		}))

		mathLib.rawSet(null, "sin", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "sin", value.type, "number")
			}

			return wrap(context, Math.sin(value.value))
		}))
		mathLib.rawSet(null, "cos", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "cos", value.type, "number")
			}

			return wrap(context, Math.cos(value.value))
		}))
		mathLib.rawSet(null, "tan", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "tan", value.type, "number")
			}

			return wrap(context, Math.tan(value.value))
		}))

		mathLib.rawSet(null, "min", new LVFunction((context, first, ...rest) => {
			if (first === undefined) {
				throw new LuaError(context.position, "bad argument #1 to 'min' (number expected, got no value)")
			}

			let best = first

			for (const val of rest) {
				if (val.lt(context, best).truthy()) {
					best = val
				}
			}

			return best
		}))
		mathLib.rawSet(null, "max", new LVFunction((context, first, ...rest) => {
			if (first === undefined) {
				throw new LuaError(context.position, "bad argument #1 to 'max' (number expected, got no value)")
			}

			let best = first

			for (const val of rest) {
				if (best.lt(context, val).truthy()) {
					best = val
				}
			}

			return best
		}))

		mathLib.rawSet(null, "deg", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "deg", value.type, "number")
			}

			return wrap(context, value.value * (180 / Math.PI))
		}))
		mathLib.rawSet(null, "rad", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "rad", value.type, "number")
			}

			return wrap(context, value.value / (180 / Math.PI))
		}))

		mathLib.rawSet(null, "exp", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "exp", value.type, "number")
			}

			return wrap(context, Math.exp(value.value))
		}))

		mathLib.rawSet(null, "fmod", new LVFunction((context, left, right) => {
			if (left.type !== "number") {
				errors.badArgType(context.position, 1, "fmod", left.type, "number")
			}
			if (right.type !== "number") {
				errors.badArgType(context.position, 2, "fmod", right.type, "number")
			}

			return wrap(context, left.value - Math.floor(left.value / right.value) * right.value)
		}))
		mathLib.rawSet(null, "modf", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "modf", value.type, "number")
			}

			const int = value.value < 0 ? Math.ceil(value.value) : Math.floor(value.value)
			const frac = value.value - int

			return new LVTuple([wrap(context, int), wrap(context, frac)])
		}))

		mathLib.rawSet(null, "huge", wrap(null, Infinity))

		mathLib.rawSet(null, "log", new LVFunction((context, value, base) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "log", value.type, "number")
			}

			if (base === undefined) {
				return wrap(context, Math.log(value.value))
			}

			if (base.type !== "number") {
				errors.badArgType(context.position, 2, "log", base.type, "number")
			}

			return wrap(context, Math.log(value.value) / Math.log(base.value))
		}))

		mathLib.rawSet(null, "pi", wrap(null, Math.PI))

		mathLib.rawSet(null, "random", new LVFunction((context, min, max) => {
			if (min === undefined && max === undefined) {
				return wrap(context, Math.random())
			}
			else if (max === undefined) {
				if (min.type !== "number") {
					errors.badArgType(context.position, 1, "random", min.type, "number")
				}

				if (!Number.isInteger(min.value)) {
					throw new LuaError(context.position, "bad argument #1 to 'random' (number has no integer representation)")
				}

				return wrap(context, Math.floor(Math.random() * min.value) + 1)
			}

			if (min.type !== "number") {
				errors.badArgType(context.position, 1, "random", min.type, "number")
			}
			if (max.type !== "number") {
				errors.badArgType(context.position, 2, "random", max.type, "number")
			}

			if (!Number.isInteger(min.value)) {
				throw new LuaError(context.position, "bad argument #1 to 'random' (number has no integer representation)")
			}
			if (!Number.isInteger(max.value)) {
				throw new LuaError(context.position, "bad argument #2 to 'random' (number has no integer representation)")
			}

			if (min.value > max.value) {
				throw new LuaError(context.position, "bad argument #2 to 'random' (interval is empty)")
			}

			return wrap(context, Math.floor(Math.random() * (max.value - min.value + 1)) + min.value)
		}))

		mathLib.rawSet(null, "sqrt", new LVFunction((context, value) => {
			if (value.type !== "number") {
				errors.badArgType(context.position, 1, "sqrt", value.type, "number")
			}

			return wrap(context, Math.sqrt(value.value))
		}))

		this.globals.rawSet(null, "math", mathLib)

		const stringLib = new LVTable()

		stringLib.rawSet(null, "sub", new LVFunction((context, str, start, end) => {
			let trueStr = str
			if (str.type === "number") {
				trueStr = str.asString(context)
			}
			if (trueStr.type !== "string") {
				errors.badArgType(context.position, 1, "sub", str.type, "string")
			}

			let trueStart = start
			if (start.type === "string") {
				trueStart = start.asNumber(context)
			}
			if (trueStart.type !== "number") {
				errors.badArgType(context.position, 2, "sub", start.type, "string")
			}

			let trueEnd = end
			if (end.type === "string") {
				trueEnd = end.asNumber(context)
			}
			if (trueEnd.type !== "number") {
				errors.badArgType(context.position, 3, "sub", end.type, "string")
			}

			if (trueStart.value < 0) {
				trueStart = trueStart.value + trueStr.value.length + 1
			}
			else {
				trueStart = trueStart.value
			}
			if (trueEnd.value < 0) {
				trueEnd = trueEnd.value + trueStr.value.length + 1
			}
			else {
				trueEnd = trueEnd.value
			}

			return new LVString(trueStr.value.slice(trueStart - 1, trueEnd))
		}))

		stringLib.rawSet(null, "len", new LVFunction((context, str) => {
			let trueStr = str
			if (str.type === "number") {
				trueStr = str.asString(context)
			}
			if (trueStr.type !== "string") {
				errors.badArgType(context.position, 1, "len", str.type, "string")
			}

			return wrap(context, trueStr.value.length)
		}))

		this.globals.rawSet(null, "string", stringLib)

		const coroutineLib = new LVTable()

		const normalize = (context, result) => {
			if (result instanceof LVTuple) {
				return result.values
			}

			return [wrap(context, result)]
		}

		coroutineLib.rawSet(null, "yield", new LVFunction((context, ...values) => {
			throw new LuaYield(values)
		}))

		coroutineLib.rawSet(null, "resume", new LVFunction((context, coroutine, ...args) => {
			if (!(coroutine instanceof LVCoroutine)) {
				errors.badArgType(context.position, 1, "resume", co.type, "coroutine")
			}

			if (coroutine.status === "dead") {
				return new LVTuple([wrap(context, false), wrap(context, "cannot resume dead coroutine")])
			}

			coroutine.status = "running"

			const result = this.runCoroutine(coroutine, ...args)

			if (coroutine.status === "suspended") {
				return new LVTuple([wrap(context, true), ...result.values])
			}

			coroutine.status = "dead"
			return new LVTuple([wrap(context, true), ...normalize(context, result)])
		}))

		coroutineLib.rawSet(null, "create", new LVFunction((context, func) => {
			if (func.type !== "function") {
				errors.badArgType(context.position, 1, "create", func.type, "function")
			}
			return new LVCoroutine(func, [])
		}))

		this.globals.rawSet(null, "coroutine", coroutineLib)

		this.globals.rawSet(null, "print", new LVFunction((context, ...msgs) => {
			const text = (msgs.map((msg) => msg.print(context))).join("\t")
			console.log(text)
		}))

		this.globals.rawSet(null, "next", new LVFunction((context, table, lastKey) => {
			if (table.type !== "table") {
				errors.badArgType(context.position, 1, "next", table.type, "table")
			}

			const keys = table.keys()
			let start = 0

			if (!lastKey || lastKey.type !== "nil") {
				start = keys.findIndex((key) => key == unwrap(lastKey))
				if (start === -1) {
					throw new LuaError(context.position, `invalid key to 'next'`)
				}

				start ++
			}

			if (start >= keys.length) {
				return wrap(context)
			}

			const key = keys[start]
			const val = table.rawGet(context, key)

			return new LVTuple([wrap(context, key), val])
		}))

		this.globals.rawSet(null, "select", new LVFunction((context, index, ...args) => {
			if (unwrap(index) === "#") {
				return wrap(context, args.length)
			}

			if (index.type !== "number") {
				errors.badArgType(context.position, 1, "select", index.type, "number")
			}
			const value = unwrap(index)
			if (!Number.isInteger(value)) {
				throw new LuaError(context.position, `bad argument #1 to 'select' (number has no integer representation)`)
			}

			if (value > args.length) {
				return new LVTuple([])
			}

			let i = value
			if (i < 0) {
				i = args.length + i + 1
			}

			if (i <= 0 || i > args.length) {
				throw new LuaError(context.position, `bad argument #1 to 'select' (index out of range)`)
			}

			return new LVTuple(args.slice(value - 1))
		}))

		this.globals.rawSet(null, "pairs", new LVFunction((context, table) => {
			const nextFn = this.globals.rawGet(context, "next")

			return new LVTuple([nextFn, table, new LVNil()])
		}))

		this.globals.rawSet(null, "setmetatable", new LVFunction((context, table, metatable) => {
			if (table.type !== "table") {
				errors.badArgType(context.position, 1, "setmetatable", table.type, "table")
			}
			
			const protection = getMeta(context, table, "__metatable")
			if (protection && protection.type !== "nil") {
				throw new LuaError(context.position, "cannot change a protected metatable")
			}

			table.metatable = metatable

			return table
		}))
		this.globals.rawSet(null, "getmetatable", new LVFunction((context, table) => {
			if (table.type !== "table") {
				errors.badArgType(context.position, 1, "getmetatable", table.type, "table")
			}

			const protection = getMeta(context, table, "__metatable")
			if (protection && protection.type !== "nil") {
				return protection
			}

			return wrap(context, table.metatable)
		}))

		this.globals.rawSet(null, "tonumber", new LVFunction((context, value) => {
			return value.asNumber(context)
		}))
		this.globals.rawSet(null, "tostring", new LVFunction((context, value) => {
			return value.asString(context)
		}))

		this.mainProto = this.readPrototype()
	}

	sliceBytes(start, end) {
		const len = end - start
		
		const out = new Uint8Array(len)
		out.set(this.data.subarray(start, end))
		
		return out
	}

	readBytes(amount) {
		const bytes = this.sliceBytes(this.pos, this.pos + amount)
		this.pos += amount

		return bytes
	}

	readByte() {
		return this.readBytes(1)[0]
	}

	readLuaInt() {
		switch (this.intSize) {
			case 1:
				return new DataView(this.readBytes(1).buffer).getInt8(0)
			case 2:
				return new DataView(this.readBytes(2).buffer).getInt16(0, this.isLittleEndian)
			case 4:
				return new DataView(this.readBytes(4).buffer).getInt32(0, this.isLittleEndian)
			case 8:
				return Number(new DataView(this.readBytes(8).buffer).getBigInt64(0, this.isLittleEndian))
			default:
				throw new LuaCFormatError(`unsupported lua number size: ${this.intSize}`)
		}
	}
	readLuaUInt() {
		switch (this.intSize) {
			case 1:
				return new DataView(this.readBytes(1).buffer).getUint8(0)
			case 2:
				return new DataView(this.readBytes(2).buffer).getUint16(0, this.isLittleEndian)
			case 4:
				return new DataView(this.readBytes(4).buffer).getUint32(0, this.isLittleEndian)
			case 8:
				return Number(new DataView(this.readBytes(8).buffer).getBigUint64(0, this.isLittleEndian))
			default:
				throw new LuaCFormatError(`unsupported lua number size: ${this.intSize}`)
		}
	}

	readLuaSizeT() {
		switch (this.sizeTSize) {
			case 1:
				return new DataView(this.readBytes(1).buffer).getUint8(0)
			case 2:
				return new DataView(this.readBytes(2).buffer).getUint16(0, this.isLittleEndian)
			case 4:
				return new DataView(this.readBytes(4).buffer).getUint32(0, this.isLittleEndian)
			case 8:
				return Number(new DataView(this.readBytes(8).buffer).getBigUint64(0, this.isLittleEndian))
			default:
				throw new LuaCFormatError(`unsupported lua number size: ${this.sizeTSize}`)
		}
	}

	readLuaNumber() {
		if (this.luaNumIsInt) {
			switch (this.luaNumSize) {
				case 1:
					return new DataView(this.readBytes(1).buffer).getInt8(0)
				case 2:
					return new DataView(this.readBytes(2).buffer).getInt16(0, this.isLittleEndian)
				case 4:
					return new DataView(this.readBytes(4).buffer).getInt32(0, this.isLittleEndian)
				case 8:
					return Number(new DataView(this.readBytes(8).buffer).getBigInt64(0, this.isLittleEndian))
				default:
					throw new LuaCFormatError(`unsupported lua number size: ${this.luaNumSize}`)
			}
		}
		else {
			switch (this.luaNumSize) {
				case 4:
					return new DataView(this.readBytes(4).buffer).getFloat32(0, this.isLittleEndian)
				case 8:
					return new DataView(this.readBytes(8).buffer).getFloat64(0, this.isLittleEndian)
				default:
					throw new LuaCFormatError(`unsupported lua number size: ${this.luaNumSize}`)
			}
		}
	}

	readLuaString() {
		const len = this.readLuaSizeT()
		if (len === 0) {
			return null
		}

		const bytes = this.readBytes(len - 1)
		this.readByte()

		return String.fromCharCode(...bytes)
	}

	readPrototype() {
		let fileName = this.readLuaString()
		if (fileName !== null) {
			fileName = fileName.slice(1)
		}

		const lineDefined = this.readLuaInt()
		const lastLineDefined = this.readLuaInt()

		const upValueCount = this.readByte()

		const paramCount = this.readByte()

		const isVarArg = this.readByte() > 0

		const maxStackSize = this.readByte()

		const instCount = this.readLuaUInt()

		const insts = []
		for (let i = 0; i < instCount; i ++) {
			switch (this.instSize) {
				case 1:
					insts.push(this.readByte())
					break
				case 2:
					insts.push(new DataView(this.readBytes(2).buffer).getUint16(0, this.isLittleEndian))
					break
				case 4:
					insts.push(new DataView(this.readBytes(4).buffer).getUint32(0, this.isLittleEndian))
					break
				default:
					throw new LuaCFormatError(`unsupported instruction size: ${this.instSize}`)
			}
		}

		const constCount = this.readLuaUInt()

		const constants = []
		for (let i = 0; i < constCount; i ++) {
			const constType = this.readByte()

			switch (constType) {
				case 0:
					constants.push(new LVNil())
					break
				case 1:
					constants.push(new LVBoolean(this.readByte() > 0))
					break
				case 3:
					constants.push(new LVNumber(this.readLuaNumber()))
					break
				case 4:
					constants.push(new LVString(this.readLuaString()))
					break
				default:
					throw new LuaCFormatError(`unsupported constant type: ${constType}`)
			}
		}

		const nestedProtoCount = this.readLuaUInt()

		const nestedProtos = []
		for (let i = 0; i < nestedProtoCount; i ++) {
			nestedProtos.push(this.readPrototype())
		}

		const lineInfoCount = this.readLuaUInt()

		const lineInfo = []
		for (let i = 0; i < lineInfoCount; i ++) {
			lineInfo.push(this.readLuaUInt())
		}

		const localCount = this.readLuaUInt()

		const locals = []
		for (let i = 0; i < localCount; i ++) {
			locals.push({
				name: this.readLuaString(),
				startPc: this.readLuaUInt(),
				endPc: this.readLuaUInt()
			})
		}

		const upValueNameCount = this.readLuaUInt()

		const upValueNames = []
		for (let i = 0; i < upValueNameCount; i ++) {
			upValueNames.push(this.readLuaString())
		}

		return {
			fileName,

			nestedProtos,

			constants,

			locals,

			lineInfo,

			lineDefined,
			lastLineDefined,

			upValueCount,
			upValueNames,

			paramCount,

			isVarArg,

			maxStackSize,

			insts
		}
	}

	decodeInst(inst) {
		const opcode = inst & 0x3F

		const A = (inst >>> 6) & 0xFF
		const C = (inst >>> 14) & 0x1FF
		const B = (inst >>> 23) & 0x1FF

		const Bx = inst >>> 14
		const sBx = Bx - 131071

		return {
			opcode,
			name: LUA_OPCODES[this.version][opcode],

			A,
			B,
			C,

			Bx,
			sBx
		}
	}

	runCoroutine(coroutine) {
		const proto = coroutine.closure.proto

		const setReg = (i, v) => {
			coroutine.regs[i] = v
			
			if (i >= coroutine.top) {
				coroutine.top = i + 1
			}
		}

		const BITRK = 1 << 8
		const MAXINDEXRK = BITRK - 1

		const RK = (regs, proto, x) => {
			if (x & BITRK) {
				const idx = x & MAXINDEXRK

				return proto.constants[idx]
			}

			return regs[x]
		}

		const floatingByteToInt = (x) => {
			if (x < 8) {
				return x
			}
			
			const e = (x >>> 3) - 1
			const m = (x & 7) + 8
		
			return m << e
		}

		const LFIELDS_PER_FLUSH = 50

		const normalize = (context, result) => {
			if (result instanceof LVTuple) {
				return result.values
			}

			return [wrap(context, result)]
		}

		const findOrCreateUpValue = (regIndex) => {
			for (const upValue of openUpValues) {
				if (upValue.isOpen && upValue.index === regIndex) {
					return upValue
				}
			}
			
			const upValue = new LVUpValue(coroutine.regs, regIndex)
			openUpValues.push(upValue)
			
			return upValue
		}

		const first = (value) => {
			if (value instanceof LVTuple) {
				return value.values[0]
			}

			return value
		}

		try {
			while (coroutine.pc >= 0 && coroutine.pc < proto.insts.length) {
				const inst = this.decodeInst(proto.insts[coroutine.pc ++])

				const { A, B, C, Bx, sBx } = inst

				const position = {
					fileName: proto.fileName,
					line: proto.lineInfo[coroutine.pc]
				}
				const context = {
					position,
					vm: this
				}

				switch (inst.name) {
					case "MOVE": {
						setReg(A, coroutine.regs[B])
						break
					}

					case "LOADK": {
						setReg(A, proto.constants[Bx])
						break
					}

					case "LOADBOOL": {
						setReg(A, new LVBoolean(B !== 0))

						if (C !== 0) {
							pc ++
						}
						break
					}

					case "LOADNIL": {
						for (let i = A; i <= B; i ++) {
							setReg(i, new LVNil())
						}
						break
					}

					case "GETGLOBAL": {
						const key = proto.constants[Bx]
						const val = this.globals.rawGet(context, key)
						
						setReg(A, val)
						break
					}

					case "SETGLOBAL": {
						const key = proto.constants[Bx]

						this.globals.rawSet(context, key, coroutine.regs[A])
						break
					}

					case "NEWTABLE": {
						const arrSize = floatingByteToInt(B)
						// const hashSize = floatingByteToInt(C)

						const tbl = new LVTable()

						tbl.array.length = arrSize

						setReg(A, tbl)
						break
					}

					case "GETTABLE": {
						const table = coroutine.regs[B]
						const key = RK(coroutine.regs, proto, C)

						setReg(A, table.rawGet(context, key))
						break
					}

					case "SETTABLE": {
						const table = coroutine.regs[A]
						
						const key = RK(coroutine.regs, proto, B)
						const val = RK(coroutine.regs, proto, C)
						
						table.rawSet(context, key, val)
						break
					}

					case "SELF": {
						const table = coroutine.regs[B]
						const key = RK(coroutine.regs, proto, C)

						setReg(A + 1, table)

						setReg(A, table.rawGet(context, key))
						break
					}

					case "SETLIST": {
						let count = B
						let extra = C

						if (extra === 0) {
							extra = proto.insts[coroutine.pc ++]
						}

						if (count === 0) {
							count = coroutine.top - (A + 1)
						}

						const table = coroutine.regs[A]
						const offset = (extra - 1) * LFIELDS_PER_FLUSH

						for (let i = 1; i <= count; i ++) {
							const val = coroutine.regs[A + i]
							table.rawSet(context, offset + i, val)
						}

						break
					}

					case "CLOSURE": {
						const newProto = proto.nestedProtos[Bx]
						const newClosure = new LVClosure(newProto)

						for (let i = 0; i < newProto.upValueCount; i ++) {
							const upValueInst = this.decodeInst(proto.insts[pc ++])

							switch (upValueInst.name) {
								case "MOVE":
									newClosure.upvalues[i] = findOrCreateUpValue(upValueInst.B)
									break
								case "GETUPVAL":
									newClosure.upvalues[i] = coroutine.closure.upvalues[upValueInst.B]
									break
								default:
									throw new LuaError(position, `invalid upvalue binding instruction: ${upValueInst.name}`)
							}
						}

						setReg(A, newClosure)
						break
					}

					case "GETUPVAL": {
						const upValue = coroutine.closure.upvalues[B]

						setReg(A, upValue.get())
						break
					}
					
					case "SETUPVAL": {
						const upValue = coroutine.closure.upvalues[B]
						
						upValue.set(regs[A])
						break
					}

					case "CLOSE": {
						for (const upValue of coroutine.openUpValues) {
							if (upValue.isOpen && upValue.index >= A) {
								upValue.close()
							}
						}
						break
					}

					case "CALL": {
						const callee = coroutine.regs[A]

						let argCount
						if (B === 0) {
							argCount = coroutine.top - (A + 1)
						}
						else {
							argCount = B - 1
						}

						const args = coroutine.regs.slice(A + 1, A + 1 + argCount)

						let result = call(context, callee, ...args)

						const values = normalize(context, result)

						if (C === 0) {
							for (let i = 0; i < values.length; i ++) {
								setReg(A + i, values[i])
							}
							coroutine.top = A + values.length

							break
						}
						else if (C === 1) {
							break
						}

						const returnCount = C - 1

						for (let i = 0; i < returnCount; i ++) {
							setReg(A + i, values[i] ?? new LVNil())
						}

						coroutine.top = A + returnCount
						break
					}

					case "RETURN": {
						for (const upValue of coroutine.openUpValues) {
							upValue.close()
						}

						if (B === 0) {
							const values = coroutine.regs.slice(A, coroutine.top)
							return new LVTuple(values)
						}
						else if (B === 1) {
							return new LVTuple([])
						}

						const returnCount = B - 1

						if (returnCount === 1) {
							return coroutine.regs[A]
						}

						const values = regs.slice(A, A + returnCount)

						return new LVTuple(values)
					}

					case "TAILCALL": {
						const callee = coroutine.regs[A]

						let argCount
						if (B === 0) {
							argCount = coroutine.top - (A + 1)
						} else {
							argCount = B - 1
						}

						const args = coroutine.regs.slice(A + 1, A + 1 + argCount)

						for (const upValue of coroutine.openUpValues) {
							upValue.close()
						}

						const result = call(context, callee, ...args)
						const values = normalize(context, result)

						if (C === 0) {
							return new LVTuple(values)
						}
						else if (C === 1) {
							return new LVTuple([])
						}

						const returnCount = C - 1

						if (returnCount === 1) {
							return values[0] ?? new LVNil()
						}

						const sliced = values.slice(0, returnCount).map((returned) => returned ?? new LVNil())

						return new LVTuple(sliced)
					}

					case "ADD":
					case "SUB":
					case "MUL":
					case "DIV":
					case "MOD":
					case "POW": {
						const left = first(RK(coroutine.regs, proto, B))
						const right = first(RK(coroutine.regs, proto, C))

						let result

						switch (inst.name) {
							case "ADD": result = left.add(context, right); break
							case "SUB": result = left.sub(context, right); break
							case "MUL": result = left.mul(context, right); break
							case "DIV": result = left.div(context, right); break
							case "MOD": result = left.mod(context, right); break
							case "POW": result = left.pow(context, right); break
						}

						setReg(A, result)
						break
					}

					case "CONCAT": {
						let result = first(RK(coroutine.regs, proto, B))

						for (let i = B + 1; i <= C; i ++) {
							const next = first(RK(coroutine.regs, proto, i))
							
							result = result.concat(context, next)
						}

						setReg(A, result)
						break
					}

					case "EQ":
					case "LT":
					case "LE": {
						const left = first(RK(coroutine.regs, proto, B))
						const right = first(RK(coroutine.regs, proto, C))

						let result

						switch (inst.name) {
							case "EQ": result = left.eq(context, right); break
							case "LT": result = left.lt(context, right); break
							case "LE": result = left.le(context, right); break
						}

						if (result.truthy() !== (A !== 0)) {
							coroutine.pc ++
						}
						break
					}

					case "JMP": {
						for (const upValue of coroutine.openUpValues) {
							if (upValue.isOpen && upValue.index >= A) {
								upValue.close()
							}
						}

						coroutine.pc += sBx
						break
					}

					case "TEST":
					case "TESTSET": {
						const val = coroutine.regs[B]
						const cond = val.truthy(context)

						if (cond !== (C !== 0)) {
							coroutine.pc ++
						} else {
							if (inst.name === "TESTSET") {
								setReg(A, val)
							}
						}
						break
					}

					case "UNM":
					case "NOT":
					case "LEN": {
						const value = RK(coroutine.regs, proto, B)

						let result

						switch (inst.name) {
							case "UNM": result = value.unm(context); break
							case "NOT": result = value.not(context); break
							case "LEN": result = value.len(context); break
						}

						setReg(A, result)
						break
					}

					case "FORPREP": {
						const counter = coroutine.regs[A]
						const limit = coroutine.regs[A + 1]
						const step = coroutine.regs[A + 2]

						if (counter.type !== "number") {
							errors.forInit(position)
						}
						if (limit.type !== "number") {
							errors.forLimit(position)
						}
						if (step.type !== "number") {
							errors.forStep(position)
						}

						setReg(A, coroutine.regs[A].sub(context, coroutine.regs[A + 2]))

						coroutine.pc += sBx
						break
					}

					case "FORLOOP": {
						const counter = coroutine.regs[A]
						const limit = coroutine.regs[A + 1]
						const step = coroutine.regs[A + 2]

						const newCounter = counter.add(context, step)
						setReg(A, newCounter)

						let continueLoop = false

						if (step.le(context, wrap(context, 0)).truthy()) {
							if (limit.le(context, newCounter).truthy()) {
								continueLoop = true
							}
						}
						else {
							if (newCounter.le(context, limit).truthy()) {
								continueLoop = true
							}
						}

						if (continueLoop) {
							setReg(A + 3, coroutine.regs[A])

							coroutine.pc += sBx
						}
						break
					}

					case "TFORLOOP": {
						const iter = coroutine.regs[A]
						const state = coroutine.regs[A + 1]
						const ctrl = coroutine.regs[A + 2]

						let result = call(context, iter, state, ctrl)

						const values = normalize(context, result)

						const newCtrl = values[0] ?? new LVNil()

						if (newCtrl.type === "nil") {
							coroutine.pc += Bx - 1
							break
						}

						setReg(A + 2, newCtrl)

						for (let i = 0; i < values.length; i ++) {
							setReg(A + 3 + i, values[i])
						}

						break
					}

					case "VARARG": {
						const varArgCount = coroutine.args.length - proto.paramCount

						if (!proto.isVarArg) {
							if (B === 0) { top = A }
							break
						}

						if (B === 0) {
							for (let i = 0; i < varArgCount; i ++) {
								setReg(A + i, coroutine.args[proto.paramCount + i])
							}
							coroutine.top = A + varArgCount
						}
						else {
							const nToCopy = B - 1

							const copyCount = Math.min(nToCopy, varArgCount)
							for (let i = 0; i < copyCount; i ++) {
								setReg(A + i, coroutine.args[proto.paramCount + i])
							}

							for (let i = copyCount; i < nToCopy; i ++) {
								setReg(A + i, new LVNil())
							}
						}

						break
					}

					default: {
						throw new LuaCFormatError(`invalid opcode ${inst.name}`)
					}
				}
			}
		}
		catch (error) {
			if (error instanceof LuaYield) {
				coroutine.status = "suspended"
				return new LVTuple(error.values)
			}
			throw error
		}
	}

	run() {
		return this.runCoroutine(new LVCoroutine(new LVClosure(this.mainProto)))
	}
}

module.exports = {
	wrap,
	unwrap,
	LuaError,
	LuaCFormatError,
	LuaVM
}