const sortList = [document.getElementsByClassName('import-sort'), document.getElementsByClassName('function-sort'), document.getElementsByClassName('variable-sort')]
for (const elList of sortList) {
    for (const el of elList) {
        el.addEventListener("click", function () {
            const urlParams = new URLSearchParams(window.location.search)
            urlParams.set(el.className, el.innerHTML)
            window.location.search = urlParams.toString()
        })
    }
}
