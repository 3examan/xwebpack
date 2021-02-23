;(function(modules) {

    const ensureJs = function(filepath) {
        const excludeFileType = ['.css']
        if (!filepath.endsWith('.js') && !excludeFileType.some(ft => filepath.endsWith(ft))) {
            filepath += '.js'
        }
        return filepath
    }

    const cachedModules = {}

    const requireById = function(id) {
        // console.log('requireById', id)
        if (cachedModules[id]) {
            return cachedModules[id].exports
        }

        const module = { exports: {} }
        cachedModules[id] = module

        const [func, mapper] = modules[id]

        const requireByName = function(name) {
            name = ensureJs(name)
            // console.log('requireByName', name, mapper)
            return requireById(mapper[name])
        }

        func(requireByName, module, module.exports)

        return module.exports
    }

    requireById(0)
})
