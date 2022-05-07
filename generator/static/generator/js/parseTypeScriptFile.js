const types = require("ast-types");

const fs = require('fs')
const source =  fs.readFileSync(process.argv[2]).toString()

const recast = require('recast')
const tsParser = require("recast/parsers/typescript")

const ast = recast.parse(source, {
  parser: tsParser
});

let objectJSON = {
  "file": {
    "imports": [],
    "functions": [],
    "variables": []
  }
}
types.visit(ast, {
  visitFunction(path) {
    if (path.node.type == 'FunctionDeclaration') {
      let funcJSON = {}
      let funcParams = {}
      let funcReturns = "Nothing"
      let funcCalls = []
      let funcName = 'anonymous'

      if (path.node.id) {
        funcName = path.node.id.name
      }
      for (const param of path.node.params) {
        funcParams[param.name] = param.typeAnnotation.typeAnnotation.type
      }
      for (const block of path.node.body.body) {
        if (block.type == 'ReturnStatement') {
          funcReturns = block.argument.name
        }
        if (block.type == 'ExpressionStatement') {
          if (block.expression.callee) {
            funcCalls.push(block.expression.callee.name)
          }
        }
      }
      funcJSON = {
        'name': funcName,
        'parameters': funcParams,
        'returns': funcReturns,
        'calls': [...funcCalls]
      }
      objectJSON['file']['functions'].push(funcJSON)
    }
    return false
  }
})
console.log(JSON.stringify(objectJSON))

// console.dir(ast, {'maxArrayLength': null, depth: null});
