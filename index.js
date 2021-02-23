#!/usr/bin/env node

const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto');


////////////////////////////////
// 工具函数
////////////////////////////////

const log = console.log.bind(console)

const compose = function(...functions) {
    if (functions.length === 1) {
        return functions[0]
    }
    return (...args) => functions.reduceRight((acc, fn) => typeof acc === 'function' ? fn(acc(...args)) : fn(acc))
}

const xwebpackConfig = function() {
    const filepath = path.resolve(__dirname, '../../xwebpack.config.js')
    if (!fs.existsSync(filepath)) {
        return {}
    }
    return require(filepath)
}

const ensureJs = function(filepath) {
    const excludeFileType = ['.css']
    if (!filepath.endsWith('.js') && !excludeFileType.some(ft => filepath.endsWith(ft))) {
        filepath += '.js'
    }
    return filepath
}


////////////////////////////////
// XWebpack 编译器
////////////////////////////////

class Compiler {
    constructor(config) {
        this.config = config
        this.loaders = config.module.rules || []
        this.plugins = config.plugins || []
        // this.bundledJsPath = path.resolve(config.output.path, config.output.filename)
        this.id = 0
    }

    parse(filepath) {
        let content = fs.readFileSync(filepath, 'utf-8')
        content = this.applyLoaders(filepath, content)
        const ast = parser.parse(content, {
            sourceType: 'module',
            plugins: [
                'jsx',
                'classProperties',
            ],
        })
        return ast
    }

    resolveDeps(ast) {
        const deps = []
        traverse(ast, {
            ImportDeclaration: ({ node }) => {
                const path = ensureJs(node.source.value)
                deps.push(path)
            }
        })
        return deps
    }

    resolveAsset(filepath) {
        const ast = this.parse(filepath)
        const deps = this.resolveDeps(ast)
        const { code } = babel.transformFromAstSync(ast, null, {
            presets: [
                '@babel/env',
            ],
            plugins: [
                ["@babel/transform-react-jsx", {
                    "pragma": "React.createElement",
                }],
                "@babel/plugin-proposal-class-properties",
            ],
        })
        return {
            id: this.id++,
            filepath,
            deps,
            code,
            mapper: {},
        }
    }

    buildDepGraph(entryPath) {
        const asset = this.resolveAsset(ensureJs(entryPath))
        const assets = [asset]
        const cache = {}

        const dfs = asset => {
            // log('loop', asset.filepath)
            const { filepath, deps } = asset
            const dirname = path.dirname(filepath)

            for (let relativePath of deps) {
                const absolutePath = path.resolve(dirname, relativePath)
                // log('deps', absolutePath)
                const child = cache[absolutePath] || this.resolveAsset(absolutePath)
                asset.mapper[relativePath] = child.id
                if (!cache[absolutePath]) {
                    cache[absolutePath] = child
                    assets.push(child)
                    dfs(child)
                }
            }
        }
        dfs(asset)
        return assets
    }

    applyLoaders(filepath, content) {
        for (let loader of this.loaders) {
            const { test, use } = loader
            if (test.test(filepath)) {
                const composedLoader = compose(...use.map(l => require(path.resolve(__dirname, 'loaders', l))))
                content = composedLoader(content)
            }
        }
        return content
    }

    bundle(depGraph) {
        let modules = []

        for (let asset of depGraph) {
            const moduleCode = this.bundleModule(asset)
            modules.push(moduleCode)
        }

        const bundledCode = this.bundleModules(modules.join('\n'))
        return bundledCode
    }

    bundleModule(module) {
        const { id, code, mapper } = module
        return `${id}: [
    function(require, module, exports) {
        ${code}
    },
    ${JSON.stringify(mapper)}
],`
    }

    bundleModules(modules) {
        const templatePath = path.resolve(__dirname, 'bundle.template.js')
        const template = fs.readFileSync(templatePath)
        return `${template}({${modules}})`
    }

    compile() {
        const outputDir = this.config.output.path
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir)
        }
        const entryPath = this.config.entry
        const depGraph = this.buildDepGraph(entryPath)
        const content = this.bundle(depGraph)
        const hash = crypto.createHash('md5').update(content).digest('hex');
        this.bundledJsHash = hash
        let bundledJsPath = path.join(outputDir, this.config.output.filename)
        bundledJsPath = bundledJsPath.replace('[contenthash]', hash)
        fs.writeFileSync(bundledJsPath, content)
        this.plugins.forEach(p => p.apply(this))
    }
}


const main = function() {
    const config = xwebpackConfig()
    const compiler = new Compiler(config)
    compiler.compile()
}


if (require.main === module) {
    main()
}
