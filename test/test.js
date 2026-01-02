const fs = require("fs")
const { LuaVM } = require("../index.js")

const data = fs.readFileSync("test/test.luac")

const vm = new LuaVM(data)

vm.run()