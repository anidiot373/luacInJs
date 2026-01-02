const errors = {
	arithmetic: (type) => {
		throw new Error(`attempt to perform arithmetic on a ${type} value`)
	},
	concatenate: (type) => {
		throw new Error(`attempt to concatenate a ${type} value`)
	},
	compare: (leftType, rightType) => {
		if (leftType === rightType) {
			throw new Error(`attempt to compare two ${leftType} values`)
		}
		throw new Error(`attempt to compare ${leftType} with ${rightType}`)
	},
	length: (type) => {
		throw new Error(`attempt to get length of a ${type} value`)
	},
	forLimit: () => {
		throw new Error("'for' limit must be a number")
	},
	forInit: () => {
		throw new Error("'for' initial value must be a number")
	},
	forStep: () => {
		throw new Error("'for' step must be a number")
	},
	call: (type) => {
		throw new Error(`attempt to call a ${type} value`)
	},
	badArg: (index, funcName, type, expected) => {
		throw new Error(`bad argument #${index} to \'${funcName}\' (${expected} expected, got ${type})`)
	}
}

class LVBase {
	constructor(type) {
		this.type = type
		this.metatable = null
	}

	add(other) { errors.arithmetic(this.type) }
	sub(other) { errors.arithmetic(this.type) }
	mul(other) { errors.arithmetic(this.type) }
	div(other) { errors.arithmetic(this.type) }
	mod(other) { errors.arithmetic(this.type) }
	pow(other) { errors.arithmetic(this.type) }

	concat(other) { errors.concatenate(this.type) }

	eq(other) { return new LVBoolean(this === other) }
	lt(other) { errors.compare(this.type, other.type) }
	le(other) { errors.compare(this.type, other.type) }

	unm() { errors.arithmetic(this.type) }
	not() { return new LVBoolean(!this.truthy()) }
	len() { errors.length(this.type) }

	truthy() { return false }
}

class LVNumber extends LVBase {
	constructor(num) {
		super("number")

		this.value = num
	}

	overrideable(operation, metaMethodName, notFoundOperation) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		return notFoundOperation()
	}

	add(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "string") {
				otherVal = Number(otherVal)
			}

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value + otherVal)
			}

			return undefined
		}, "__add", () => {
			errors.arithmetic(other.type)
		})
	}

	sub(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "string") {
				otherVal = Number(otherVal)
			}

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value - otherVal)
			}

			return undefined
		}, "__sub", () => {
			errors.arithmetic(other.type)
		})
	}

	mul(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "string") {
				otherVal = Number(otherVal)
			}

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value * otherVal)
			}

			return undefined
		}, "__mul", () => {
			errors.arithmetic(other.type)
		})
	}

	div(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "string") {
				otherVal = Number(otherVal)
			}

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
			errors.arithmetic(other.type)
		})
	}

	mod(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "string") {
				otherVal = Number(otherVal)
			}

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value % otherVal)
			}

			return undefined
		}, "__mod", () => {
			errors.arithmetic(other.type)
		})
	}

	pow(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "string") {
				otherVal = Number(otherVal)
			}

			if (isNaN(otherVal)) {
				return undefined
			}

			if (typeof otherVal === "number") {
				return new LVNumber(this.value ** otherVal)
			}

			return undefined
		}, "__pow", () => {
			errors.arithmetic(other.type)
		})
	}

	concat(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "number") {
				otherVal = String(otherVal)
			}

			if (typeof otherVal === "string") {
				return new LVString(String(this.value) + otherVal)
			}

			return undefined
		}, "__concat", () => {
			errors.concatenate(other.type)
		})
	}

	eq(other) {
		return new LVBoolean(this.type === other.type && this.value === other.value)
	}

	lt(other) {
		return this.overrideable(() => {
			if (this.type === other.type) {
				return new LVBoolean(this.value < other.value)
			}
			
			return undefined
		}, "__lt", () => {
			errors.compare(this.type, other.type)
		})
	}
	
	le(other) {
		return this.overrideable(() => {
			if (this.type === other.type) {
				return new LVBoolean(this.value <= other.value)
			}
			
			return undefined
		}, "__le", () => {
			errors.compare(this.type, other.type)
		})
	}

	unm() {
		return new LVNumber(-this.value)
	}

	truthy() {
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
			throw new Error("invalid string literal; could not convert to bytestring")
		}

		this.value = bytes
	}

	overrideable(operation, metaMethodName, notFoundOperation) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		return notFoundOperation()
	}

	concat(other) {
		return this.overrideable(() => {
			let otherVal = other.value
			if (other.type === "number") {
				otherVal = String(otherVal)
			}

			if (typeof otherVal === "string") {
				return new LVString(this.value + otherVal)
			}

			return undefined
		}, "__concat", () => {
			errors.concatenate(other.type)
		})
	}

	eq(other) {
		return new LVBoolean(this.type === other.type && this.value === other.value)
	}

	lt(other) {
		return this.overrideable(() => {
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
			errors.compare(this.type, other.type)
		})
	}
	
	le(other) {
		return this.overrideable(() => {
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
			errors.compare(this.type, other.type)
		})
	}

	len() {
		return new LVNumber(this.value.length)
	}

	truthy() {
		return true
	}
}

class LVBoolean extends LVBase {
	constructor(bool) {
		super("boolean")

		this.value = bool
	}

	overrideable(operation, metaMethodName, notFoundOperation) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		return notFoundOperation()
	}

	eq(other) {
		return new LVBoolean(this.type === other.type && this.value === other.value)
	}

	truthy() {
		return this.value
	}
}

class LVNil extends LVBase {
	constructor() {
		super("nil")

		this.value = null
	}

	overrideable(operation, metaMethodName, notFoundOperation) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		return notFoundOperation()
	}

	eq(other) {
		return new LVBoolean(this.type === other.type)
	}

	truthy() {
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

	overrideable(operation, metaMethodName, notFoundOperation) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		return notFoundOperation()
	}

	keys() {
		return this.keyOrder.slice()
	}

	rawGet(key) {
		key = unwrap(key)
	
		if (typeof key === "number" && key >= 1 && Number.isInteger(key)) {
			return this.array[key] ?? new LVNil()
		}
	
		return this.hash[key] ?? new LVNil()
	}

	rawSet(key, value) {
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

	len() {
		let i = 1
		while (this.array[i] !== undefined) {
			i ++
		}

		return new LVNumber(i - 1)
	}

	truthy() {
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

	overrideable(operation, metaMethodName, notFoundOperation) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		return notFoundOperation()
	}

	truthy() {
		return true
	}
}

class LVClosure extends LVBase {
	constructor(proto) {
		super("function")

		this.proto = proto
		this.upvalues = new Array(proto.upValueCount)
	}

	overrideable(operation, metaMethodName, notFoundOperation) {
		const result = operation()
		if (result !== undefined) {
			return result
		}

		return notFoundOperation()
	}

	truthy() {
		return true
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

function wrap(value) {
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
			
			return new LVTable()
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

function getMeta(obj, name) {
	if (!obj.metatable) {
		return undefined
	}

	return obj.metatable.rawGet(name)
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
				throw new Error("invalid luac file, incorrect signature")
			}
		}

		this.version = this.readByte()

		if (this.version !== 0x51) {
			throw new Error("only lua 5.1 is supported for now")
		}

		this.format = this.readByte()

		if (this.format !== 0) {
			throw new Error("invalid luac file, format non-zero")
		}

		const endianness = this.readByte()
		if (!([0, 1].includes(endianness))) {
			throw new Error("invalid luac file, neither big nor small endian")
		}

		this.isLittleEndian = endianness === 1

		this.intSize = this.readByte()

		this.sizeTSize = this.readByte()

		this.instSize = this.readByte()

		this.luaNumSize = this.readByte()
		
		const luaNumInt = this.readByte()
		if (!([0, 1].includes(luaNumInt))) {
			throw new Error("invalid luac file, lua number neither integral nor real")
		}

		this.luaNumIsInt = luaNumInt

		this.globals = new LVTable()

		const mathLib = new LVTable()

		mathLib.rawSet("min", new LVFunction((first, ...rest) => {
			let best = first

			for (const val of rest) {
				if (val.lt(best).truthy()) {
					best = val
				}
			}

			return best
		}))
		mathLib.rawSet("max", new LVFunction((first, ...rest) => {
			let best = first

			for (const val of rest) {
				if (best.lt(val).truthy()) {
					best = val
				}
			}

			return best
		}))

		this.globals.rawSet("math", mathLib)

		this.globals.rawSet("print", new LVFunction((...msgs) => {
			console.log(...(msgs.map((msg) => unwrap(msg))))
		}))

		this.globals.rawSet("next", new LVFunction((table, lastKey) => {
			if (table.type !== "table") {
				errors.badArg(1, "next", table.type, "table")
			}

			const keys = table.keys()
			let start = 0

			if (lastKey.type !== "nil") {
				start = keys.findIndex((key) => key == unwrap(lastKey))
				if (start === -1) {
					throw new Error("invalid key to \'next\'")
				}

				start ++
			}

			if (start >= keys.length) {
				return new LVNil()
			}

			const key = keys[start]
			const val = table.rawGet(key)

			return new LVTuple([wrap(key), val])
		}))

		this.globals.rawSet("select", new LVFunction((index, ...args) => {
			if (unwrap(index) === "#") {
				return wrap(args.length)
			}

			if (index.type !== "number") {
				errors.badArg(1, "select", index.type, "number")
			}
			const value = unwrap(index)
			if (!Number.isInteger(value)) {
				throw new Error("bad argument #1 to \'select\' (number has no integer representation)")
			}

			if (value > args.length) {
				return new LVTuple([])
			}
			if (i < 0) {
				i = args.length + i + 1
			}

			if (value <= 0) {
				throw new Error("bad argument #1 to \'select\' (index out of range)")
			}

			return new LVTuple(args.slice(value - 1))
		}))

		this.globals.rawSet("pairs", new LVFunction((table) => {
			const nextFn = this.globals.rawGet("next")

			return new LVTuple([nextFn, table, new LVNil()])
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
				throw new Error(`unsupported lua number size: ${this.intSize}`)
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
				throw new Error(`unsupported lua number size: ${this.intSize}`)
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
				throw new Error(`unsupported lua number size: ${this.sizeTSize}`)
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
					throw new Error(`unsupported lua number size: ${this.luaNumSize}`)
			}
		}
		else {
			switch (this.luaNumSize) {
				case 4:
					return new DataView(this.readBytes(4).buffer).getFloat32(0, this.isLittleEndian)
				case 8:
					return new DataView(this.readBytes(8).buffer).getFloat64(0, this.isLittleEndian)
				default:
					throw new Error(`unsupported lua number size: ${this.luaNumSize}`)
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
		const fileName = this.readLuaString()

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
					throw new Error(`unsupported instruction size: ${this.instSize}`)
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
					throw new Error(`unsupported constant type: ${constType}`)
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

	runClosure(closure, ...args) {
		const proto = closure.proto

		let openUpValues = []

		let pc = 0
		let top = 0
		let regs = Array.from({ length: proto.maxStackSize }, () => new LVNil())

		for (let i = 0; i < proto.paramCount; i ++) {
			regs[i] = args[i]
		}

		const setReg = (i, v) => {
			regs[i] = v
			
			if (i >= top) {
				top = i + 1
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

		const normalize = (result) => {
			if (result instanceof LVTuple) {
				return result.values
			}

			return [wrap(result)]
		}

		const findOrCreateUpValue = (regIndex) => {
			for (const upValue of openUpValues) {
				if (upValue.isOpen && upValue.index === regIndex) {
					return upValue
				}
			}
			
			const upValue = new LVUpValue(regs, regIndex)
			openUpValues.push(upValue)
			
			return upValue
		}

		const first = (value) => {
			if (value instanceof LVTuple) {
				return value.values[0]
			}

			return value
		}

		while (pc >= 0 && pc < proto.insts.length) {
			const inst = this.decodeInst(proto.insts[pc ++])

			const { A, B, C, Bx, sBx } = inst

			switch (inst.name) {
				case "MOVE": {
					setReg(A, regs[B])
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
					const val = this.globals.rawGet(key)
					
					setReg(A, val)
					break
				}

				case "SETGLOBAL": {
					const key = proto.constants[Bx]

					this.globals.rawSet(key, regs[A])
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
					const table = regs[B]
					const key = RK(regs, proto, C)

					setReg(A, table.rawGet(key))
					break
				}

				case "SETTABLE": {
					const table = regs[A]
					
					const key = RK(regs, proto, B)
					const val = RK(regs, proto, C)
					
					table.rawSet(key, val)
					break
				}

				case "SELF": {
					const table = regs[B]
					const key = RK(regs, proto, C)

					setReg(A + 1, table)

					setReg(A, table.rawGet(key))
					break
				}

				case "SETLIST": {
					let count = B
					let extra = C

					if (extra === 0) {
						extra = proto.insts[pc ++]
					}

					if (count === 0) {
						count = top - (A + 1)
					}

					const table = regs[A]
					const offset = (extra - 1) * LFIELDS_PER_FLUSH

					for (let i = 1; i <= count; i ++) {
						const val = regs[A + i]
						table.rawSet(offset + i, val)
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
								newClosure.upvalues[i] = closure.upvalues[upValueInst.B]
								break
							default:
								throw new Error(`invalid upvalue binding instruction: ${upValueInst.name}`)
						}
					}

					setReg(A, newClosure)
					break
				}

				case "GETUPVAL": {
					const upValue = closure.upvalues[B]

					setReg(A, upValue.get())
					break
				}
				
				case "SETUPVAL": {
					const upValue = closure.upvalues[B]
					
					upValue.set(regs[A])
					break
				}

				case "CLOSE": {
					for (const upValue of openUpValues) {
						if (upValue.isOpen && upValue.index >= A) {
							upValue.close()
						}
					}
					break
				}

				case "CALL": {
					const callee = regs[A]

					let argCount
					if (B === 0) {
						argCount = top - (A + 1)
					}
					else {
						argCount = B - 1
					}

					const args = regs.slice(A + 1, A + 1 + argCount)

					let result

					if (typeof callee === "function") {
						result = callee(...args)
					}
					else if (callee instanceof LVFunction) {
						result = callee.value(...args)
					}
					else if (callee instanceof LVClosure) {
						result = this.runClosure(callee, ...args)
					}
					else {
						errors.call(callee.type)
					}

					const values = normalize(result)

					if (C === 0) {
						for (let i = 0; i < values.length; i ++) {
							setReg(A + i, values[i])
						}
						top = A + values.length

						break
					}
					else if (C === 1) {
						break
					}

					const returnCount = C - 1

					for (let i = 0; i < returnCount; i ++) {
						setReg(A + i, values[i] ?? new LVNil())
					}

					top = A + returnCount
					break
				}

				case "RETURN": {
					for (const upValue of openUpValues) {
						upValue.close()
					}

					if (B === 0) {
						const values = regs.slice(A, top)
						return new LVTuple(values)
					}
					else if (B === 1) {
						return new LVTuple([])
					}

					const returnCount = B - 1

					if (returnCount === 1) {
						return regs[A]
					}

					const values = regs.slice(A, A + returnCount)

					return new LVTuple(values)
				}

				case "TAILCALL": {
					const callee = regs[A]

					let argCount
					if (B === 0) {
						argCount = top - (A + 1)
					} else {
						argCount = B - 1
					}

					const args = regs.slice(A + 1, A + 1 + argCount)

					for (const upValue of openUpValues) {
						upValue.close()
					}

					if (callee instanceof LVFunction) {
						return callee.value(...args)
					}
					else if (callee instanceof LVClosure) {
						return this.runClosure(callee, ...args)
					}
					else {
						errors.call(callee.type)
					}
				}

				case "ADD":
				case "SUB":
				case "MUL":
				case "DIV":
				case "MOD":
				case "POW": {
					const left = first(RK(regs, proto, B))
					const right = first(RK(regs, proto, C))

					let result

					switch (inst.name) {
						case "ADD": result = left.add(right); break
						case "SUB": result = left.sub(right); break
						case "MUL": result = left.mul(right); break
						case "DIV": result = left.div(right); break
						case "MOD": result = left.mod(right); break
						case "POW": result = left.pow(right); break
					}

					setReg(A, result)
					break
				}

				case "CONCAT": {
					let result = first(RK(regs, proto, B))

					for (let i = B + 1; i <= C; i ++) {
						const next = first(RK(regs, proto, i))
						
						result = result.concat(next)
					}

					setReg(A, result)
					break
				}

				case "EQ":
				case "LT":
				case "LE": {
					const left = first(RK(regs, proto, B))
					const right = first(RK(regs, proto, C))

					let result

					switch (inst.name) {
						case "EQ": result = left.eq(right); break
						case "LT": result = left.lt(right); break
						case "LE": result = left.le(right); break
					}

					if (result.truthy() !== (A !== 0)) {
						pc ++
					}
					break
				}

				case "JMP": {
					for (const upValue of openUpValues) {
						if (upValue.isOpen && upValue.index >= A - 1) {
							upValue.close()
						}
					}

					pc += sBx
					break
				}

				case "TEST":
				case "TESTSET": {
					const val = regs[B]
					const cond = val.truthy()

					if (cond !== (C !== 0)) {
						pc ++
					} else {
						setReg(A, val)
					}
					break
				}

				case "UNM":
				case "NOT":
				case "LEN": {
					const value = RK(regs, proto, B)

					let result

					switch (inst.name) {
						case "UNM": result = value.unm(); break
						case "NOT": result = value.not(); break
						case "LEN": result = value.len(); break
					}

					setReg(A, result)
					break
				}

				case "FORPREP": {
					setReg(A, regs[A].sub(regs[A + 2]))

					pc += sBx
					break
				}

				case "FORLOOP": {
					const counter = regs[A]
					const limit = regs[A + 1]
					const step = regs[A + 2]

					if (counter.type !== "number") {
						errors.forInit()
					}
					if (limit.type !== "number") {
						errors.forLimit()
					}
					if (step.type !== "number") {
						errors.forStep()
					}

					const newCounter = counter.add(step)
					setReg(A, newCounter)

					let continueLoop = false

					if (step.le(wrap(0)).truthy()) {
						if (limit.le(newCounter).truthy()) {
							continueLoop = true
						}
					}
					else {
						if (newCounter.le(limit).truthy()) {
							continueLoop = true
						}
					}

					if (continueLoop) {
						setReg(A + 3, regs[A])

						pc += sBx
					}
					break
				}

				case "TFORLOOP": {
					const iter = regs[A]
					const state = regs[A + 1]
					const ctrl = regs[A + 2]

					let result
					if (iter instanceof LVFunction) {
						result = iter.value(state, ctrl)
					} else if (iter instanceof LVClosure) {
						result = this.runClosure(iter, state, ctrl)
					} else {
						errors.call(iter.type)
					}

					const values = normalize(result)

					const newCtrl = values[0] ?? new LVNil()

					if (newCtrl.type === "nil") {
						pc += Bx - 1
						break
					}

					setReg(A + 2, newCtrl)

					for (let i = 0; i < values.length; i ++) {
						setReg(A + 3 + i, values[i])
					}

					break
				}

				case "VARARG": {
					const varArgCount = args.length - proto.paramCount

					if (B === 0) {
						for (let i = 0; i < varArgCount; i ++) {
							setReg(A + i, args[proto.paramCount + i])
						}
					} else {
						const nToCopy = B - 1

						const copyCount = Math.min(nToCopy, varArgCount)
						for (let i = 0; i < copyCount; i ++) {
							setReg(A + i, args[proto.paramCount + i])
						}

						for (let i = copyCount; i < nToCopy; i ++) {
							setReg(A + i, new LVNil())
						}
					}

					break
				}

				default: {
					throw new Error(`invalid opcode ${inst.name}`)
				}
			}
		}
	}

	run() {
		return this.runClosure(new LVClosure(this.mainProto))
	}
}

module.exports = {
	wrap,
	unwrap,
	LuaVM
}