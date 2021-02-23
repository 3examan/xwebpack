const styleLoader = function(content) {
    // console.log('styleLoader')

    content = `
const __xwebpack_style = document.createElement('style')
__xwebpack_style.innerHTML = ${JSON.stringify(content)}
document.head.appendChild(__xwebpack_style)
`
    return content
}

module.exports = styleLoader
