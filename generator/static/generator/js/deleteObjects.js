const classSelector = document.getElementsByClassName('list-delete-button')

for (const item of classSelector) {
    item.addEventListener('click', function() {
        if (item.id.includes('import')) {
            const trueID = item.id.slice(11)
            window.location.href = '/delete/import/' + trueID
        }
        if (item.id.includes('function')) {
            const trueID = item.id.slice(13)
            window.location.href = '/delete/function/' + trueID
        }
        if (item.id.includes('variable')) {
            const trueID = item.id.slice(13)
            window.location.href = '/delete/variable/' + trueID
        }
        if (item.id.includes('project')) {
            const trueID = item.id.slice(10)
            window.location = '/delete/project/' + trueID
        }
    })
}