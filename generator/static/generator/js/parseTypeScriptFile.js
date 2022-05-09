const types = require("ast-types");

const fs = require('fs')
const source =  fs.readFileSync(process.argv[2]).toString()
// const source = `
//
// const globalVariable = 'test'
//
// const tLiteralVariable = \`
// This is a test.
// This is also a test.
// \`
//
// export const boomtownURL = envUrls[0].boomtown.a[0].lot.of.properties
//
// function testFunction(test: string) {
//   const yellow = getYellow()
//   const green = 'green'
// }
//
// const [body, email] = generateUser(baseName, i)
//
// const automationListingUrl = \`\${boomtownURL}/api/automations/?sAction=listing\${anotherTest}\`
//
// const thisIsATest = test + test2 + test3
//
// `
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
let finalObject = ''
let args = ''

function findAllProperties(mainObject) {
  if (mainObject) {
    if (mainObject.name) {
      finalObject = mainObject.name + '.' + finalObject
      findAllProperties(mainObject.object)
    }
    if (mainObject.property) {
      if (mainObject.property.type === 'NumericLiteral') {
        finalObject = '[' + mainObject.property.value + ']' + '.' + finalObject
        findAllProperties(mainObject.object)
      }
      if (mainObject.property.name) {
        finalObject = mainObject.property.name + '.' + finalObject
        findAllProperties(mainObject.object)
      }
    }
  }
}

// types.visit(ast,{
//   visitMemberExpression(path) {
//     const finalProperty = path.node.property.name
//     findAllProperties(path.node.object)
//     finalObject = finalObject + finalProperty
//     return false
//   },
// })

function parseNonStringTemplateLiteral(declaration, j, variableValue) {
  if (declaration.init.expressions[j]) {
    if (declaration.init.expressions[j].type === 'CallExpression') {
      if (declaration.init.expressions[j].arguments) {
        for (const argument of declaration.init.expressions[j].arguments) {
          args = args + ',' + argument.name
          variableValue = variableValue +
              '${' +
              declaration.init.expressions[j].callee.name +
              `(${args})` +
              '}'
          args = ''
        }
      } else {
        variableValue = variableValue + '${' + declaration.init.expressions[j].callee.name
      }
    } else {
      variableValue = variableValue + '${' + declaration.init.expressions[j].name + '}'
    }
  }
  return variableValue;
}

function parseTemplateLiteral(declaration, variableValue) {
  let j = 0
  for (let quasi of declaration.init.quasis) {
    if (quasi.value.cooked === '') {
      variableValue = parseNonStringTemplateLiteral(declaration, j, variableValue);
      j++

    } else if (quasi.value.cooked !== 'undefined') {
      variableValue = variableValue + quasi.value.cooked
    }
  }
  return variableValue;
}

let binaryExpressionValue = ''
function parseBinaryExpression(declaration) {
  const left = declaration.init.left
  const right = declaration.init.right
  for (const l of left) {
    if (l) {
      if (l.type !== 'BinaryExpression') {
        if (l.name) {
          binaryExpressionValue = binaryExpressionValue + l.name
        }
        if (l.value) {
          binaryExpressionValue = binaryExpressionValue + l.value
        }
        if (l.quasis) {
          binaryExpressionValue = binaryExpressionValue + parseTemplateLiteral(l)
        }
      }
      if (l.type === 'BinaryExpression') {
        binaryExpressionValue = binaryExpressionValue + l.operator
        parseBinaryExpression([l.left, l.right], right)
      }
    }
  }
  for (const r of right) {
    if (r) {
      if (r.type !== 'BinaryExpression') {
        if (r.name) {
          binaryExpressionValue = binaryExpressionValue + r.name
        }
        if (r.value) {
          binaryExpressionValue = binaryExpressionValue + r.value
        }
        if (r.quasis) {
          binaryExpressionValue = binaryExpressionValue + parseTemplateLiteral(r)
        }
      }
      if (right.type === 'BinaryExpression') {
        binaryExpressionValue = binaryExpressionValue + r.operator
        parseBinaryExpression(left, [r.left, r.right])
      }
    }
  }
  return binaryExpressionValue
}

function parseDeclaration(declaration, variableType, variableValue) {
  if (declaration.init) {
    variableType = declaration.init.type
    if (declaration.init.value) {
      variableValue = declaration.init.value
    }
    if (declaration.init.type === 'TemplateLiteral') {
      variableValue = parseTemplateLiteral(declaration, variableValue);
    }
    if (declaration.init.type === 'MemberExpression') {
      const finalProperty = declaration.init.property.name
      findAllProperties(declaration.init.object)
      finalObject = finalObject + finalProperty
      variableValue = finalObject
    }
    if (declaration.init.type === 'BinaryExpression') {
      variableValue = parseBinaryExpression(declaration)
      binaryExpressionValue = ''
    }
    if (declaration.init.callee) {
      variableValue = declaration.init.callee.name
    }
  }
  return {variableType, variableValue};
}

function provisionVariable(path, variableName, variableType, variableValue) {
  for (const declaration of path.node.declarations) {
    if (declaration.id.name) {
      variableName = declaration.id.name
    }
    if (declaration.id.elements) {
      for (const element of declaration.id.elements) {
        variableName = variableName + ',' + element.name
      }
    }
    const parsedDeclaration = parseDeclaration(declaration, variableType, variableValue);
    variableType = parsedDeclaration.variableType;
    variableValue = parsedDeclaration.variableValue;
  }
  return {variableName, variableType, variableValue};
}

types.visit(ast, {
  visitVariableDeclaration(path) {
    let variableJSON = {}
    let variableName = ''
    let variableType = ''
    let variableValue = ''
    let variableUsedBy = []
    const variable = provisionVariable(path, variableName, variableType, variableValue);
    variableName = variable.variableName;
    variableType = variable.variableType;
    variableValue = variable.variableValue;
    variableJSON = {
      'name': variableName,
      'type': variableType,
      'value': variableValue
    }
    finalObject = ''

    objectJSON['file']['variables'].push(variableJSON)
    return false
  }
})
types.visit(ast, {
  visitFunction(path) {
    if (path.node.type === 'FunctionDeclaration') {
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
        if (block.type === 'ReturnStatement') {
          funcReturns = block.argument.name
        }
        if (block.type === 'ExpressionStatement') {
          if (block.expression.callee) {
            funcCalls.push(block.expression.callee.name)
          }
        }
        if (block.type === 'VariableDeclaration') {
          if (block.declarations) {
            for (const declaration of block.declarations) {
              if (declaration.init.callee) {
                funcCalls.push(declaration.init.callee.name)
              }
            }
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

// console.log(JSON.stringify(ast))