const fs = require('fs')
const path = require('path')


class HtmlXWebpackPlugin {
    constructor(options) {
        this.options = options
    }

    apply(compiler) {
        const { filename, template } = this.options
        const { output } = compiler.config
        const outputPath = path.resolve(output.path, filename)
        const bundledJsPath = output.filename.replace('[contenthash]', compiler.bundledJsHash)
        this.emit(outputPath, template, bundledJsPath)
    }

    emit(outputPath, templatePath, bundledJsPath) {
        const template = fs.readFileSync(templatePath, 'utf-8')
        const content = template.replace('</body>', `
    <script src='${bundledJsPath}'></script>
</body>
`)
        fs.writeFileSync(outputPath, content)
    }
}

module.exports = HtmlXWebpackPlugin
